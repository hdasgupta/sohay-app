#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from collections import defaultdict

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}

STATUS_TEXT = {
    "200": "Successful response",
    "201": "Created",
    "202": "Accepted",
    "204": "No content",
    "400": "Bad request",
    "401": "Unauthorized",
    "403": "Forbidden",
    "404": "Not found",
    "409": "Conflict",
    "422": "Validation error",
    "500": "Internal server error",
}


def remove_comments(source: str) -> str:
    source = re.sub(r"/*.*?*/", "", source, flags=re.DOTALL)
    source = re.sub(r"//[^
]*", "", source)
    return source


def find_matching(source: str, open_index: int, open_char="(", close_char=")") -> int:
    depth = 0
    quote = None
    escaped = False
    i = open_index

    while i < len(source):
        char = source[i]

        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        else:
            if char in ("'", '"', "`"):
                quote = char
            elif char == open_char:
                depth += 1
            elif char == close_char:
                depth -= 1
                if depth == 0:
                    return i

        i += 1

    return -1


def split_top_level_arguments(argument_text: str):
    arguments = []
    start = 0
    depth_paren = 0
    depth_brace = 0
    depth_bracket = 0
    quote = None
    escaped = False

    for i, char in enumerate(argument_text):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue

        if char in ("'", '"', "`"):
            quote = char
        elif char == "(":
            depth_paren += 1
        elif char == ")":
            depth_paren -= 1
        elif char == "{":
            depth_brace += 1
        elif char == "}":
            depth_brace -= 1
        elif char == "[":
            depth_bracket += 1
        elif char == "]":
            depth_bracket -= 1
        elif (
            char == ","
            and depth_paren == 0
            and depth_brace == 0
            and depth_bracket == 0
        ):
            arguments.append(argument_text[start:i].strip())
            start = i + 1

    final_arg = argument_text[start:].strip()
    if final_arg:
        arguments.append(final_arg)

    return arguments


def extract_js_string(value: str):
    value = value.strip()

    match = re.fullmatch(r"""['"]([^'"]*)['"]""", value, flags=re.DOTALL)
    if match:
        return match.group(1)

    match = re.fullmatch(r"`([^`$]*)`", value, flags=re.DOTALL)
    if match:
        return match.group(1)

    return None


def normalize_path(path: str) -> str:
    path = path.replace("\\", "/")
    path = re.sub(r"/+", "/", path)

    if not path.startswith("/"):
        path = "/" + path

    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]

    return path


def join_paths(base_path: str, route_path: str) -> str:
    base_path = normalize_path(base_path)
    route_path = normalize_path(route_path)

    if base_path == "/":
        return route_path

    if route_path == "/":
        return base_path

    return normalize_path(base_path.rstrip("/") + "/" + route_path.lstrip("/"))


def express_path_to_openapi(path: str) -> str:
    path = re.sub(r":([A-Za-z_][A-Za-z0-9_]*)?", r"{\u0001}", path)
    path = re.sub(r":([A-Za-z_][A-Za-z0-9_]*)", r"{\u0001}", path)
    return path


def infer_value_schema(value: str):
    value = value.strip()

    if re.fullmatch(r"-?d+", value):
        return {"type": "integer"}

    if re.fullmatch(r"-?d+.d+", value):
        return {"type": "number", "format": "float"}

    if value in ("true", "false"):
        return {"type": "boolean"}

    if value == "null":
        return {"nullable": True}

    if value.startswith("["):
        return {"type": "array", "items": {}}

    if value.startswith("{"):
        return {"type": "object"}

    return {"type": "string"}


def infer_json_schema(json_expression: str):
    json_expression = json_expression.strip()

    if json_expression.startswith("["):
        return {
            "type": "array",
            "items": {"type": "object"},
        }

    if not json_expression.startswith("{"):
        return {"type": "object"}

    inner = json_expression[1:-1].strip()
    if not inner:
        return {"type": "object", "properties": {}}

    properties = {}
    required = []

    for item in split_top_level_arguments(inner):
        if ":" not in item:
            continue

        key, value = item.split(":", 1)
        key = key.strip().strip("'"")
        value = value.strip()

        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            continue

        properties[key] = infer_value_schema(value)
        required.append(key)

    schema = {"type": "object"}

    if properties:
        schema["properties"] = properties
        schema["required"] = required

    return schema


def infer_parameters(handler_code: str, openapi_path: str):
    parameters = []
    seen = set()

    path_parameter_names = re.findall(r"{([A-Za-z_][A-Za-z0-9_]*)}", openapi_path)

    for name in path_parameter_names:
        parameters.append(
            {
                "name": name,
                "in": "path",
                "required": True,
                "schema": {"type": "string"},
            }
        )
        seen.add(("path", name))

    for name in re.findall(r"req.params.([A-Za-z_][A-Za-z0-9_]*)", handler_code):
        if ("path", name) not in seen:
            parameters.append(
                {
                    "name": name,
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"},
                }
            )
            seen.add(("path", name))

    for name in re.findall(r"req.query.([A-Za-z_][A-Za-z0-9_]*)", handler_code):
        if ("query", name) not in seen:
            parameters.append(
                {
                    "name": name,
                    "in": "query",
                    "required": False,
                    "schema": {"type": "string"},
                }
            )
            seen.add(("query", name))

    query_object_match = re.search(r"consts*{([^}]+)}s*=s*req.query", handler_code)
    if query_object_match:
        for raw_name in query_object_match.group(1).split(","):
            name = raw_name.strip().split("=")[0].strip()
            if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name) and ("query", name) not in seen:
                parameters.append(
                    {
                        "name": name,
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                    }
                )
                seen.add(("query", name))

    return parameters


def infer_request_body(handler_code: str, method: str):
    if method.lower() not in {"post", "put", "patch"}:
        return None

    if "req.body" not in handler_code:
        return None

    properties = {}
    required = []

    destructuring_match = re.search(r"consts*{([^}]+)}s*=s*req.body", handler_code)
    if destructuring_match:
        for raw_field in destructuring_match.group(1).split(","):
            field = raw_field.strip().split("=")[0].strip()
            if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", field):
                properties[field] = {"type": "string"}
                required.append(field)

    schema = {"type": "object"}

    if properties:
        schema["properties"] = properties
        schema["required"] = required
    else:
        schema["additionalProperties"] = True

    return {
        "required": True,
        "content": {
            "application/json": {
                "schema": schema
            }
        },
    }


def infer_responses(handler_code: str):
    response_statuses = set()
    response_schema = None

    for status in re.findall(r"res.status(s*(d{3})s*)", handler_code):
        response_statuses.add(status)

    json_matches = list(re.finditer(r"res(?:.status(s*(d{3})s*))?.json(s*", handler_code))

    for match in json_matches:
        status = match.group(1) or "200"
        response_statuses.add(status)

        open_paren = handler_code.find("(", match.start())
        close_paren = find_matching(handler_code, open_paren)
        if close_paren != -1 and response_schema is None:
            json_expression = handler_code[open_paren + 1:close_paren]
            response_schema = infer_json_schema(json_expression)

    if re.search(r"res(?:.status(s*d{3}s*))?.send(", handler_code):
        response_statuses.add("200")

    if not response_statuses:
        response_statuses.add("200")

    responses = {}

    for status in sorted(response_statuses):
        response = {
            "description": STATUS_TEXT.get(status, "Response")
        }

        if response_schema and status != "204":
            response["content"] = {
                "application/json": {
                    "schema": response_schema
                }
            }

        responses[status] = response

    return responses


def make_operation(method: str, path: str, handler_code: str, tag: str):
    operation = {
        "tags": [tag],
        "summary": f"{method.upper()} {path}",
        "responses": infer_responses(handler_code),
    }

    parameters = infer_parameters(handler_code, path)
    if parameters:
        operation["parameters"] = parameters

    request_body = infer_request_body(handler_code, method)
    if request_body:
        operation["requestBody"] = request_body

    return operation


def find_direct_routes(source: str, base_path: str, tag: str):
    routes = []
    pattern = re.compile(r"\b(?:router|app).(get|post|put|patch|delete|head|options)s*(")

    for match in pattern.finditer(source):
        open_paren = source.find("(", match.start())
        close_paren = find_matching(source, open_paren)

        if close_paren == -1:
            continue

        arguments_text = source[open_paren + 1:close_paren]
        arguments = split_top_level_arguments(arguments_text)

        if not arguments:
            continue

        route_path = extract_js_string(arguments[0])
        if route_path is None:
            continue

        full_path = express_path_to_openapi(join_paths(base_path, route_path))
        handler_code = ",".join(arguments[1:])

        routes.append(
            {
                "method": match.group(1).lower(),
                "path": full_path,
                "operation": make_operation(match.group(1), full_path, handler_code, tag),
            }
        )

    return routes


def find_route_chains(source: str, base_path: str, tag: str):
    routes = []
    route_pattern = re.compile(r"\b(?:router|app).routes*(")

    for match in route_pattern.finditer(source):
        route_open_paren = source.find("(", match.start())
        route_close_paren = find_matching(source, route_open_paren)

        if route_close_paren == -1:
            continue

        route_path = extract_js_string(source[route_open_paren + 1:route_close_paren])
        if route_path is None:
            continue

        full_path = express_path_to_openapi(join_paths(base_path, route_path))

        chain_start = route_close_paren + 1
        chain_end = source.find(";", chain_start)

        if chain_end == -1:
            chain_end = min(len(source), chain_start + 10000)

        chain = source[chain_start:chain_end]
        method_pattern = re.compile(r".s*(get|post|put|patch|delete|head|options)s*(")

        for method_match in method_pattern.finditer(chain):
            method_open_paren = chain.find("(", method_match.start())
            method_close_paren = find_matching(chain, method_open_paren)

            if method_close_paren == -1:
                continue

            handler_code = chain[method_open_paren + 1:method_close_paren]

            routes.append(
                {
                    "method": method_match.group(1).lower(),
                    "path": full_path,
                    "operation": make_operation(
                        method_match.group(1),
                        full_path,
                        handler_code,
                        tag,
                    ),
                }
            )

    return routes


def scan_router_file(file_path: Path, base_path: str):
    source = remove_comments(file_path.read_text(encoding="utf-8", errors="ignore"))
    tag = file_path.stem.replace(".router", "").replace("_", " ").replace("-", " ").title()

    routes = []
    routes.extend(find_direct_routes(source, base_path, tag))
    routes.extend(find_route_chains(source, base_path, tag))

    return routes


def build_openapi(router_dir: Path, base_path: str, title: str, version: str, server_url: str):
    paths = defaultdict(dict)

    extensions = {".js", ".cjs", ".mjs", ".ts"}

    for file_path in router_dir.rglob("*"):
        if not file_path.is_file() or file_path.suffix not in extensions:
            continue

        for route in scan_router_file(file_path, base_path):
            paths[route["path"]][route["method"]] = route["operation"]

    document = {
        "openapi": "3.0.3",
        "info": {
            "title": title,
            "version": version,
            "description": "Generated by static analysis of Express router source files.",
        },
        "paths": dict(sorted(paths.items())),
    }

    if server_url:
        document["servers"] = [{"url": server_url}]

    return document


def main():
    parser = argparse.ArgumentParser(
        description="Generate OpenAPI JSON by scanning Express router source code."
    )
    parser.add_argument(
        "router_directory",
        help="Directory containing Express router files.",
    )
    parser.add_argument(
        "--output",
        default="openapi.json",
        help="Output JSON file. Default: openapi.json",
    )
    parser.add_argument(
        "--base-path",
        default="/",
        help="Prefix applied to every discovered route, for example /api/v1.",
    )
    parser.add_argument(
        "--title",
        default="Express API",
        help="OpenAPI document title.",
    )
    parser.add_argument(
        "--version",
        default="1.0.0",
        help="API version placed in the OpenAPI document.",
    )
    parser.add_argument(
        "--server-url",
        default="",
        help="Optional API server URL, for example http://localhost:3000.",
    )

    args = parser.parse_args()

    router_dir = Path(args.router_directory)

    if not router_dir.exists() or not router_dir.is_dir():
        raise SystemExit(f"Router directory does not exist: {router_dir}")

    document = build_openapi(
        router_dir=router_dir,
        base_path=args.base_path,
        title=args.title,
        version=args.version,
        server_url=args.server_url,
    )

    output_path = Path(args.output)
    output_path.write_text(json.dumps(document, indent=2), encoding="utf-8")

    route_count = sum(len(methods) for methods in document["paths"].values())
    print(f"Generated {output_path} with {route_count} endpoint(s).")


if __name__ == "__main__":
    main()

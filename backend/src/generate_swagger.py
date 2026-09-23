import os
import re
import json

def convert_express_path(path):
    """Converts Express parameter syntax (:id) to OpenAPI syntax ({id})."""
    path_params = re.findall(r':([a-zA-Z0-9_]+)', path)
    openapi_path = re.sub(r':([a-zA-Z0-9_]+)', r'{\1}', path)
    return openapi_path, path_params

def extract_block_content(code, start_idx):
    """Extracts code block body enclosed in curly braces, handling nested functions and blocks."""
    first_brace = code.find('{', start_idx)
    if first_brace == -1:
        return ""
    
    depth = 0
    for i in range(first_brace, len(code)):
        if code[i] == '{':
            depth += 1
        elif code[i] == '}':
            depth -= 1
            if depth == 0:
                return code[first_brace + 1:i]
    return ""

def parse_destructured_vars(var_string):
    """Extracts variable names from ES6 destructuring strings."""
    variables = []
    raw_vars = var_string.split(',')
    for v in raw_vars:
        v = v.strip().split('=')[0].strip().split(':')[0].strip()
        if v.startswith('...'):
            v = v[3:]
        if v and re.match(r'^[a-zA-Z0-9_]+$', v):
            variables.append(v)
    return variables

def infer_type(var_name, body):
    """Basic static type inference based on JS usage patterns."""
    if re.search(r'parseInt\s*\([^)]*' + var_name, body):
        return "integer"
    if re.search(r'(?:parseFloat|Number)\s*\([^)]*' + var_name, body):
        return "number"
    if re.search(r'Boolean\s*\([^)]*' + var_name, body) or re.search(var_name + r'\s*===?\s*(?:true|false)', body):
        return "boolean"
    return "string"

def analyze_route_handler(body, path_params):
    """Inspects route handler code for req object access and status codes."""
    
    # 1. Query parameters
    query_params = set(re.findall(r'req\.query\.([a-zA-Z0-9_]+)', body))
    for dq in re.findall(r'(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*req\.query', body):
        query_params.update(parse_destructured_vars(dq))

    # 2. Path parameters
    extracted_path_params = set(path_params)
    extracted_path_params.update(re.findall(r'req\.params\.([a-zA-Z0-9_]+)', body))
    for dp in re.findall(r'(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*req\.params', body):
        extracted_path_params.update(parse_destructured_vars(dp))

    # 3. Request body fields
    body_props = set(re.findall(r'req\.body\.([a-zA-Z0-9_]+)', body))
    for db in re.findall(r'(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*req\.body', body):
        body_props.update(parse_destructured_vars(db))

    # 4. Status codes
    status_codes = re.findall(r'res\s*\.\s*status\s*\(\s*(\d{3})\s*\)', body)
    status_codes = sorted(list(set(status_codes))) if status_codes else ["200"]

    return {
        "query": list(query_params),
        "params": list(extracted_path_params),
        "body": list(body_props),
        "status_codes": status_codes,
        "raw_body": body
    }

def process_endpoint(method, raw_path, handler_body, paths):
    """Builds the OpenAPI path item object and attaches it to the spec paths dictionary."""
    openapi_path, url_params = convert_express_path(raw_path)
    analysis = analyze_route_handler(handler_body, url_params)

    if openapi_path not in paths:
        paths[openapi_path] = {}

    parameters = []
    
    # Path params
    for p in analysis["params"]:
        parameters.append({
            "name": p,
            "in": "path",
            "required": True,
            "schema": {"type": infer_type(p, analysis["raw_body"])},
            "description": f"Path parameter {p}"
        })

    # Query params
    for q in analysis["query"]:
        parameters.append({
            "name": q,
            "in": "query",
            "required": False,
            "schema": {"type": infer_type(q, analysis["raw_body"])},
            "description": f"Query parameter {q}"
        })

    operation = {
        "summary": f"{method.upper()} {openapi_path}",
        "responses": {}
    }

    if parameters:
        operation["parameters"] = parameters

    # Request Body schema construction
    if analysis["body"] or method in ['post', 'put', 'patch']:
        properties = {
            prop: {"type": infer_type(prop, analysis["raw_body"])} 
            for prop in analysis["body"]
        }
        operation["requestBody"] = {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": properties
                    }
                }
            }
        }

    # Responses
    for status in analysis["status_codes"]:
        operation["responses"][status] = {
            "description": f"HTTP {status} response",
            "content": {
                "application/json": {}
            }
        }

    paths[openapi_path][method.lower()] = operation

def parse_router_file(file_path):
    """Scans single router file for direct routes and chained router.route() definitions."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    paths = {}

    # 1. Standard Routes: router.get('/path', ...) / app.post('/path', ...)
    standard_route_regex = re.compile(
        r'(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]+)[\'"]',
        re.IGNORECASE
    )
    for match in standard_route_regex.finditer(content):
        method = match.group(1).lower()
        raw_path = match.group(2)
        handler_body = extract_block_content(content, match.end())
        process_endpoint(method, raw_path, handler_body, paths)

    # 2. Chained Routes: router.route('/path').get(...).post(...)
    chained_route_regex = re.compile(
        r'(?:router|app)\.route\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)(.*?)(?=(?:(?:router|app)\.|\Z))',
        re.DOTALL | re.IGNORECASE
    )
    for match in chained_route_regex.finditer(content):
        raw_path = match.group(1)
        chain_block = match.group(2)
        
        method_matches = re.finditer(r'\.(get|post|put|delete|patch)\s*\(', chain_block, re.IGNORECASE)
        for m in method_matches:
            method = m.group(1).lower()
            handler_body = extract_block_content(chain_block, m.end())
            process_endpoint(method, raw_path, handler_body, paths)

    return paths

def generate_swagger(source_path, output_file="swagger.json", title="Node.js Express API"):
    """Crawls target directory or file and saves OpenAPI 3.0 JSON specification."""
    swagger_doc = {
        "openapi": "3.0.0",
        "info": {
            "title": title,
            "version": "1.0.0",
            "description": "Auto-generated OpenAPI spec created via static code inspection."
        },
        "paths": {}
    }

    files = []
    if os.path.isdir(source_path):
        for root, _, f_list in os.walk(source_path):
            for file in f_list:
                if file.endswith(('.js', '.ts')):
                    files.append(os.path.join(root, file))
    elif os.path.isfile(source_path):
        files.append(source_path)

    for file in files:
        file_paths = parse_router_file(file)
        for path, methods in file_paths.items():
            if path not in swagger_doc["paths"]:
                swagger_doc["paths"][path] = {}
            swagger_doc["paths"][path].update(methods)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(swagger_doc, f, indent=2)

    print(f"Generated '{output_file}' covering {len(swagger_doc['paths'])} routes across {len(files)} file(s).")

if __name__ == "__main__":
    # Point this to your routes directory or single router JS file
    TARGET_ROUTER_PATH = "./routes"
    
    generate_swagger(
        source_path=TARGET_ROUTER_PATH, 
        output_file="swagger.json",
        title="Express Backend API"
    )


import os
import re
import json
from pathlib import Path

PROJECT_ROOT = "./"
SRC_DIR = os.path.join(PROJECT_ROOT, "src")

# Regex to match Express path params, e.g., /users/:id -> /users/{id}
PATH_PARAM_REGEX = re.compile(r':([a-zA-Z0-9_]+)')

def convert_to_openapi_path(express_path):
    """Converts Express parameter syntax to OpenAPI syntax."""
    path_params = PATH_PARAM_REGEX.findall(express_path)
    openapi_path = PATH_PARAM_REGEX.sub(r'{\1}', express_path)
    return openapi_path, path_params

def extract_js_block(code, start_idx):
    """
    Extracts a balanced JavaScript code block enclosed in {...},
    skipping inner strings, template literals, and comments to prevent depth miscounts.
    """
    first_brace = code.find('{', start_idx)
    if first_brace == -1:
        return ""
    
    depth = 0
    in_string = None
    in_single_comment = False
    in_multi_comment = False
    escape = False

    i = first_brace
    code_len = len(code)
    while i < code_len:
        char = code[i]
        
        if escape:
            escape = False
            i += 1
            continue
            
        if char == '\\' and in_string:
            escape = True
            i += 1
            continue

        if in_single_comment:
            if char == '\n':
                in_single_comment = False
            i += 1
            continue

        if in_multi_comment:
            if char == '*' and i + 1 < code_len and code[i+1] == '/':
                in_multi_comment = False
                i += 2
                continue
            i += 1
            continue

        if not in_string:
            if char == '/' and i + 1 < code_len:
                next_char = code[i+1]
                if next_char == '/':
                    in_single_comment = True
                    i += 2
                    continue
                elif next_char == '*':
                    in_multi_comment = True
                    i += 2
                    continue
            
            if char in ("'", '"', '`'):
                in_string = char
                i += 1
                continue
                
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    return code[first_brace + 1:i]
        else:
            if char == in_string:
                in_string = None

        i += 1
    return ""

def determine_req_res_vars(signature):
    """
    Parses a JS function signature string (e.g., "req, res, next") to identify
    the variable names used for the Request and Response objects.
    """
    args = [arg.strip() for arg in signature.split(',') if arg.strip()]
    if len(args) >= 2:
        return args[0], args[1]
    elif len(args) == 3:
        return args[0], args[1]
    return 'req', 'res'

def parse_es_import_clause(clause):
    """
    Parses ES6 import clauses into a list of tuples: (local_var_name, export_name_or_symbol)
    e.g., 'h' -> [('h', 'default')]
    e.g., '* as c' -> [('c', '*')]
    e.g., '{ authenticate, authorize }' -> [('authenticate', 'authenticate'), ('authorize', 'authorize')]
    """
    clause = clause.strip()
    results = []
    
    if '{' in clause:
        parts = clause.split('{', 1)
        default_part = parts[0].strip().rstrip(',')
        named_part = parts[1].replace('}', '').strip()
        if default_part and not default_part.startswith('*'):
            results.append((default_part, 'default'))
        for item in named_part.split(','):
            item = item.strip()
            if not item:
                continue
            if ' as ' in item:
                orig, local = item.split(' as ')
                results.append((local.strip(), orig.strip()))
            else:
                results.append((item, item))
    elif '* as' in clause:
        ns_match = re.search(r'\*\s+as\s+([a-zA-Z0-9_]+)', clause)
        if ns_match:
            results.append((ns_match.group(1), '*'))
        if ',' in clause:
            default_part = clause.split(',')[0].strip()
            if default_part:
                results.append((default_part, 'default'))
    else:
        if clause and not clause.startswith('*'):
            results.append((clause, 'default'))
            
    return results

class CodebaseIndexer:
    """Scans and indexes the entire /src directory for functions, imports, and variables across all subfolders."""
    def __init__(self, src_path):
        self.src_path = src_path
        self.files = {}          # filepath -> content
        self.functions = {}      # filepath -> { function_name: { args, body } }
        self.imports = {}        # filepath -> { local_var: (target_file, export_name) }
        
    def crawl(self):
        print(f"[*] Crawling all source subdirectories in: {self.src_path}...")
        for root, _, files in os.walk(self.src_path):
            for file in files:
                if file.endswith(('.js', '.ts', '.mjs', '.cjs')):
                    filepath = os.path.normpath(os.path.join(root, file))
                    self._parse_file(filepath)
                    
        # Resolve imports across indexed files
        for filepath in self.files:
            self._parse_imports(filepath)

    def _parse_file(self, filepath):
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                self.files[filepath] = content
                self.functions[filepath] = {}
                
                # 1. Standard / Exported Named Functions: export function foo(...) / function foo(...)
                func_pattern = re.compile(r'(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)', re.MULTILINE)
                for match in func_pattern.finditer(content):
                    name, args = match.groups()
                    body = extract_js_block(content, match.end())
                    self.functions[filepath][name] = {'args': args, 'body': body}

                # 2. Export / Variable Arrow / Const Functions: export const foo = async (...) => ...
                assign_pattern = re.compile(
                    r'(?:export\s+)?(?:const|let|var|exports\.|module\.exports\.)([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:asyncHandler|catchAsync|h)?\(?\s*(?:function\s*)?(?:\(([^)]*)\)|([a-zA-Z0-9_]+))\s*(?:=>|\{)',
                    re.MULTILINE
                )
                for match in assign_pattern.finditer(content):
                    name = match.group(1)
                    args = match.group(2) if match.group(2) is not None else (match.group(3) or "")
                    body = extract_js_block(content, match.end())
                    if name not in ('module', 'exports'):
                        self.functions[filepath][name] = {'args': args, 'body': body}
                        
                # 3. Object / Class Methods
                obj_pattern = re.compile(r'(?:async\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{', re.MULTILINE)
                for match in obj_pattern.finditer(content):
                    name, args = match.groups()
                    if name not in ('if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'require', 'import', 'export'):
                        body = extract_js_block(content, match.end() - 1)
                        self.functions[filepath][name] = {'args': args, 'body': body}

        except Exception as e:
            print(f"[!] Error parsing {filepath}: {e}")

    def _parse_imports(self, filepath):
        content = self.files.get(filepath, "")
        self.imports[filepath] = {}

        # 1. ES6 import statements: import ... from '...'
        es_pattern = re.compile(r'import\s+(.*?)\s+from\s+[\'"`]([^\'"`]+)[\'"`]')
        for match in es_pattern.finditer(content):
            import_clause, import_path = match.groups()
            resolved = self.resolve_module_path(filepath, import_path)
            if resolved:
                parsed_vars = parse_es_import_clause(import_clause)
                for local_var, exp_name in parsed_vars:
                    self.imports[filepath][local_var] = (resolved, exp_name)

        # 2. CommonJS require statements: const ... = require('...')
        req_pattern = re.compile(r'(?:const|let|var)\s+({?[a-zA-Z0-9_\s,:]+}?)\s*=\s*require\([\'"`]([^\'"`]+)[\'"`]\)')
        for match in req_pattern.finditer(content):
            var_block, import_path = match.groups()
            resolved = self.resolve_module_path(filepath, import_path)
            if resolved:
                if '{' in var_block:
                    clean_vars = [v.split(':')[0].strip() for v in var_block.replace('{', '').replace('}', '').split(',')]
                    for v in clean_vars:
                        if v:
                            self.imports[filepath][v] = (resolved, v)
                else:
                    var_name = var_block.strip()
                    if var_name:
                        self.imports[filepath][var_name] = (resolved, None)

    def resolve_module_path(self, current_file, import_path):
        """Attempts to find the absolute path of an imported module."""
        if not import_path.startswith('.'):
            return None

        current_dir = os.path.dirname(current_file)
        target_path = os.path.normpath(os.path.join(current_dir, import_path))
        
        for ext in ['', '.js', '.ts', '.mjs', '.cjs', '/index.js', '/index.ts']:
            potential = target_path + ext
            if potential in self.files:
                return potential
            elif os.path.isfile(potential):
                return potential
        return None

def trace_function_dependencies(body, current_filepath, indexer, depth=0, visited=None):
    """Recursively traces calls to services, utils, controllers, and middleware functions to inline logic."""
    if visited is None:
        visited = set()
    if depth > 3 or not body:
        return body

    expanded_body = body
    call_matches = re.findall(r'([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?\s*\(', body)
    file_imports = indexer.imports.get(current_filepath, {})
    file_funcs = indexer.functions.get(current_filepath, {})

    for obj_name, method_name in call_matches:
        target_file = None
        func_key = None

        if method_name:
            if obj_name in file_imports:
                target_file, exp_type = file_imports[obj_name]
                if exp_type == '*':
                    func_key = method_name
                else:
                    func_key = exp_type or method_name
        else:
            if obj_name in file_imports:
                target_file, exp_type = file_imports[obj_name]
                func_key = exp_type if exp_type != '*' else None
            elif obj_name in file_funcs:
                target_file = current_filepath
                func_key = obj_name

        if target_file and func_key:
            call_id = f"{target_file}::{func_key}"
            if call_id not in visited:
                visited.add(call_id)
                target_funcs = indexer.functions.get(target_file, {})
                if func_key in target_funcs:
                    child_body = target_funcs[func_key]['body']
                    deeper_body = trace_function_dependencies(child_body, target_file, indexer, depth + 1, visited)
                    expanded_body += "\n" + deeper_body

    return expanded_body

def analyze_handler_body(body, req_var, res_var, path_params):
    """
    Parses the raw JS body of a controller to find query parameters,
    body attributes, and HTTP response statuses based on variable tracking.
    """
    req = re.escape(req_var)
    res = re.escape(res_var)

    def extract_destructured(target_prop):
        pattern = r'(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*' + req + rf'\.{target_prop}'
        found = set()
        for match in re.findall(pattern, body):
            for v in match.split(','):
                clean_v = v.split('=')[0].split(':')[0].strip()
                if clean_v and not clean_v.startswith('...'):
                    found.add(clean_v)
        return found

    # Query Parameters
    query_params = set(re.findall(req + r'\.query\.([a-zA-Z0-9_]+)', body))
    query_params.update(extract_destructured('query'))

    # Path Parameters
    extracted_params = set(path_params)
    extracted_params.update(re.findall(req + r'\.params\.([a-zA-Z0-9_]+)', body))
    extracted_params.update(extract_destructured('params'))

    # Body Attributes
    body_props = set(re.findall(req + r'\.body\.([a-zA-Z0-9_]+)', body))
    body_props.update(extract_destructured('body'))

    # Response Status Codes
    status_pattern = res + r'\s*\.\s*(?:status|sendStatus)\s*\(\s*(\d{3})\s*\)'
    status_codes = re.findall(status_pattern, body)
    status_codes = sorted(list(set(status_codes))) if status_codes else ["200"]

    def infer_type(var_name):
        if re.search(r'parseInt\s*\([^)]*' + var_name, body): return "integer"
        if re.search(r'(?:parseFloat|Number)\s*\([^)]*' + var_name, body): return "number"
        if re.search(r'Boolean\s*\([^)]*' + var_name, body): return "boolean"
        return "string"

    return {
        "query": [{"name": q, "type": infer_type(q)} for q in query_params],
        "params": [{"name": p, "type": infer_type(p)} for p in extracted_params],
        "body": [{"name": b, "type": infer_type(b)} for b in body_props],
        "status": status_codes
    }

def process_endpoint(method, raw_path, handler_code, req_var, res_var, prefix, swagger_paths):
    """Formats the extracted endpoint data into the OpenAPI standard JSON structure."""
    combined_path = f"{prefix.rstrip('/')}/{raw_path.lstrip('/')}".rstrip('/')
    if not combined_path:
        combined_path = "/"

    openapi_path, url_params = convert_to_openapi_path(combined_path)
    analysis = analyze_handler_body(handler_code, req_var, res_var, url_params)

    if openapi_path not in swagger_paths:
        swagger_paths[openapi_path] = {}

    parameters = []
    for p in analysis["params"]:
        parameters.append({"name": p["name"], "in": "path", "required": True, "schema": {"type": p["type"]}})
    for q in analysis["query"]:
        parameters.append({"name": q["name"], "in": "query", "required": False, "schema": {"type": q["type"]}})

    operation = {
        "summary": f"{method.upper()} {openapi_path}",
        "responses": {}
    }
    if parameters:
        operation["parameters"] = parameters

    if analysis["body"] or method in ['post', 'put', 'patch']:
        properties = {b["name"]: {"type": b["type"]} for b in analysis["body"]}
        operation["requestBody"] = {
            "required": True,
            "content": {"application/json": {"schema": {"type": "object", "properties": properties}}}
        }

    for status in analysis["status"]:
        operation["responses"][status] = {"description": f"HTTP {status} response", "content": {"application/json": {}}}

    swagger_paths[openapi_path][method.lower()] = operation

def parse_route_file(filepath, prefix, indexer, swagger_paths):
    """Scans a route file, unwrapping handlers (like h(c.method)) and resolving controller functions."""
    if filepath not in indexer.files:
        return 0
        
    content = indexer.files[filepath]
    endpoints_found = 0
    file_imports = indexer.imports.get(filepath, {})

    def resolve_handler_body(args_str):
        combined_body = ""
        req_var, res_var = "req", "res"

        # 1. Unwrap wrapper function syntax: h(c.methodName) or h(methodName)
        target_idents = re.findall(r'h\(\s*([a-zA-Z0-9_\.]+)\s*\)', args_str)
        if not target_idents:
            # Fallback to all identifiers in the arguments string
            target_idents = re.findall(r'([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)', args_str)

        for ident in target_idents:
            parts = ident.split('.')
            base_var = parts[0]
            method_name = parts[1] if len(parts) > 1 else None

            if base_var in file_imports:
                target_file, exp_type = file_imports[base_var]
                target_func_name = method_name if exp_type == '*' else (exp_type or method_name or base_var)
                
                if target_file in indexer.functions and target_func_name in indexer.functions[target_file]:
                    func_data = indexer.functions[target_file][target_func_name]
                    r_var, s_var = determine_req_res_vars(func_data['args'])
                    if r_var != 'req': req_var = r_var
                    if s_var != 'res': res_var = s_var
                    
                    full_body = trace_function_dependencies(func_data['body'], target_file, indexer)
                    combined_body += "\n" + full_body

            elif base_var in indexer.functions.get(filepath, {}):
                func_data = indexer.functions[filepath][base_var]
                r_var, s_var = determine_req_res_vars(func_data['args'])
                if r_var != 'req': req_var = r_var
                if s_var != 'res': res_var = s_var
                full_body = trace_function_dependencies(func_data['body'], filepath, indexer)
                combined_body += "\n" + full_body

        if not combined_body.strip():
            combined_body = args_str

        return combined_body, req_var, res_var

    # Route pattern matching router methods (r.get, r.post, api.get, etc.)
    route_pattern = re.compile(
        r'(?:[a-zA-Z0-9_]+)\.(get|post|put|delete|patch)\s*\(\s*[\'"`]([^\'"`]*)[\'"`]\s*,\s*(.*?)(?=\;\s*\n|\n\s*(?:[a-zA-Z0-9_]+)\.(?:get|post|put|delete|patch|use)|$)',
        re.DOTALL | re.IGNORECASE
    )
    for match in route_pattern.finditer(content):
        method, raw_path, args_str = match.groups()
        body, req_v, res_v = resolve_handler_body(args_str)
        process_endpoint(method, raw_path, body, req_v, res_v, prefix, swagger_paths)
        endpoints_found += 1
        
    return endpoints_found

def parse_base_routes(indexer):
    """Parses app.js and src/routes/index.js to build base route mount prefixes."""
    mounts = []
    index_files = [
        os.path.join(SRC_DIR, "app.js"),
        os.path.join(SRC_DIR, "routes", "index.js"),
        os.path.join(SRC_DIR, "routes.js")
    ]

    for index_path in index_files:
        if index_path not in indexer.files:
            continue

        content = indexer.files[index_path]
        file_imports = indexer.imports.get(index_path, {})
        
        use_pattern = re.compile(r'(?:app|api|router)\.use\s*\(\s*[\'"`]([^\'"`]+)[\'"`]\s*,\s*([a-zA-Z0-9_]+)\s*\)')
        for match in use_pattern.finditer(content):
            prefix, handler_var = match.groups()
            if handler_var in file_imports:
                target_file, _ = file_imports[handler_var]
                mounts.append({"prefix": prefix, "file": target_file})
            
    return mounts

def generate_swagger():
    print("=" * 70)
    print("🚀 Express ES-Module & Route Parser (Swagger Generator)")
    print("=" * 70)

    if not os.path.exists(SRC_DIR):
        print(f"[ERROR] Could not find 'src' directory at {SRC_DIR}.")
        return

    indexer = CodebaseIndexer(SRC_DIR)
    indexer.crawl()

    swagger_doc = {
        "openapi": "3.0.0",
        "info": {
            "title": "Express Application API",
            "version": "1.0.0",
            "description": "Auto-generated via static code analysis across routes, controllers, services, middleware, and utils."
        },
        "paths": {}
    }

    mounted_routers = parse_base_routes(indexer)
    processed_files = set()
    total_endpoints = 0

    print("\n[*] Analyzing mounted route paths...")
    for route in mounted_routers:
        if route["file"] not in processed_files:
            file_name = os.path.basename(route["file"])
            count = parse_route_file(route["file"], route["prefix"], indexer, swagger_doc["paths"])
            print(f"  ✅ Parsed {file_name:<20} (Mounted at: {route['prefix']:<15}) -> {count} endpoints")
            processed_files.add(route["file"])
            total_endpoints += count

    print("\n[*] Running fallback discovery on routes directory...")
    target_files = [
        "admin.routes.js", "common.routes.js", "patient.routes.js", 
        "doctor.routes.js", "webhook.routes.js"
    ]
    
    for filename in target_files:
        filepath = os.path.normpath(os.path.join(SRC_DIR, "routes", filename))
        if filepath in indexer.files and filepath not in processed_files:
            inferred_prefix = "/" if filename == "common.routes.js" else "/" + filename.split('.')[0].replace('.routes', '')
            count = parse_route_file(filepath, inferred_prefix, indexer, swagger_doc["paths"])
            print(f"  ✅ Parsed {filename:<20} (Fallback prefix: {inferred_prefix:<15}) -> {count} endpoints")
            processed_files.add(filepath)
            total_endpoints += count

    output_file = "swagger.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(swagger_doc, f, indent=2)

    print("=" * 70)
    print(f"🎉 SUMMARY: Successfully traced {total_endpoints} endpoint(s) across {len(swagger_doc['paths'])} API paths.")
    print(f"📄 Output saved to: {os.path.abspath(output_file)}")
    print("=" * 70)

if __name__ == "__main__":
    generate_swagger()

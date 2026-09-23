import os
import re
import sys
from pathlib import Path

EXCLUDE_DIRS = {"node_modules", ".git", "build", "dist", "coverage", ".next", "out", ".cache", "public"}
VALID_EXTS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}


def join_urls(*parts):
    """Cleanly joins URL fragments into a single normalized path."""
    res = ""
    for part in parts:
        if not part or part == "/":
            continue
        part = part.strip()
        if not res.endswith('/') and not part.startswith('/'):
            res += '/' + part
        elif res.endswith('/') and part.startswith('/'):
            res += part[1:]
        else:
            res += part
    res = re.sub(r'/+', '/', res)
    if not res.startswith('/'):
        res = '/' + res
    if len(res) > 1 and res.endswith('/'):
        res = res[:-1]
    return res if res else "/"


def express_route_to_regex(route_path):
    """
    Converts Express route params like /api/users/:id into regex patterns 
    that match frontend calls like /api/users/${id}, /api/users/123, or /api/users/{id}.
    """
    tokens = route_path.split('/')
    pattern_parts = []
    for token in tokens:
        if not token:
            continue
        if token.startswith(':'):
            pattern_parts.append(r'([^/"\'`\s\?]+|\$\{[^}]+\}|\{[^}]+\})')
        elif token == '*':
            pattern_parts.append(r'.*')
        else:
            pattern_parts.append(re.escape(token))
    
    pattern = r'/' + r'/'.join(pattern_parts) if pattern_parts else r'/'
    return re.compile(pattern, re.IGNORECASE)


# ==========================================
# 1. EXPRESS.JS RECURSIVE ROUTE PARSER
# ==========================================

def parse_express_routes(project_files):
    mount_tree = {}  # { child_var: [(parent_var, prefix)] }
    raw_endpoints = []  # [(var_name, method, endpoint)]

    mount_pattern = re.compile(
        r'\b(\w+)\.use\s*\(\s*[\'"`]([^\'"`]+)[\'"`]\s*,\s*(\w+)', re.IGNORECASE
    )
    endpoint_pattern = re.compile(
        r'\b(\w+)\.(get|post|put|delete|patch|all)\s*\(\s*[\'"`]([^\'"`]+)[\'"`]', re.IGNORECASE
    )

    for file_path in project_files:
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        # Track router mounts (e.g., app.use('/api/v1', userRouter))
        for match in mount_pattern.finditer(content):
            parent_var, prefix, child_var = match.groups()
            if child_var not in mount_tree:
                mount_tree[child_var] = []
            mount_tree[child_var].append((parent_var, prefix))

        # Track route declarations (e.g., router.get('/users', userController))
        for match in endpoint_pattern.finditer(content):
            var_name, method, endpoint = match.groups()
            raw_endpoints.append((var_name, method.upper(), endpoint))

    def resolve_var_prefixes(var_name, visited=None):
        if visited is None:
            visited = set()
        if var_name in visited:
            return ["/"]
        visited.add(var_name)

        if var_name.lower() == "app" or var_name not in mount_tree:
            return ["/"]

        prefixes = []
        for parent_var, prefix in mount_tree[var_name]:
            parent_prefixes = resolve_var_prefixes(parent_var, visited.copy())
            for p_prefix in parent_prefixes:
                prefixes.append(join_urls(p_prefix, prefix))
        return prefixes or ["/"]

    endpoints = []
    for var_name, method, endpoint in raw_endpoints:
        prefixes = resolve_var_prefixes(var_name)
        for prefix in prefixes:
            full_url = join_urls(prefix, endpoint)
            endpoints.append((method, full_url))

    return endpoints


# ==========================================
# 2. REACT ROUTER RECURSIVE ROUTE PARSER
# ==========================================

def parse_react_routes(project_files):
    web_urls = set()

    # Match JSX <Route> tags
    jsx_route_pattern = re.compile(
        r'(</Route>|<Route\b[^>]*?\bpath=\s*(?:\{?\s*[\'"`]([^\'"`]+)[\'"`]\s*\}?|[\'"`]([^\'"`]+)[\'"`])[^>]*?(/\s*>|>))',
        re.IGNORECASE
    )
    # Match JS Object Route configs (path: '...')
    obj_path_pattern = re.compile(r'\bpath:\s*[\'"`]([^\'"`]+)[\'"`]', re.IGNORECASE)

    for file_path in project_files:
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        # Recursive JSX tree stack
        route_stack = []
        for match in jsx_route_pattern.finditer(content):
            full_match = match.group(1)

            if full_match == "</Route>":
                if route_stack:
                    route_stack.pop()
            else:
                path_val = match.group(2) or match.group(3)
                closing_slash = match.group(4)

                if path_val:
                    route_stack.append(path_val)
                    full_url = join_urls(*route_stack)
                    web_urls.add(full_url)

                    if closing_slash and "/" in closing_slash:
                        route_stack.pop()

        # Object / Data Router parsing
        for match in obj_path_pattern.finditer(content):
            path_val = match.group(1)
            if path_val:
                web_urls.add(join_urls(path_val))

    return sorted(list(web_urls))


# ==========================================
# 3. FILTER API URLS USED IN FRONTEND
# ==========================================

def filter_api_urls_used_in_frontend(express_endpoints, frontend_files):
    frontend_contents = []
    for file_path in frontend_files:
        try:
            frontend_contents.append(file_path.read_text(encoding="utf-8", errors="ignore"))
        except Exception:
            pass

    combined_frontend_code = "\n".join(frontend_contents)
    used_api_urls = set()

    for method, url in express_endpoints:
        regex = express_route_to_regex(url)
        
        # Check direct regex match against frontend source code
        if regex.search(combined_frontend_code):
            used_api_urls.add(f"[{method:<6}] {url}")
        else:
            # Check base endpoint path without param suffix (e.g. /api/v1/users)
            base_url = re.sub(r'/:.*', '', url)
            if base_url and len(base_url) > 1 and base_url in combined_frontend_code:
                used_api_urls.add(f"[{method:<6}] {url}")

    return sorted(list(used_api_urls))


# ==========================================
# MAIN EXECUTION
# ==========================================

def main(target_dir):
    root_path = Path(target_dir).resolve()

    if not root_path.exists() or not root_path.is_dir():
        print(f"Error: Directory '{root_path}' does not exist.")
        sys.exit(1)

    project_files = []
    frontend_files = []

    for file_path in root_path.rglob("*"):
        if any(part in EXCLUDE_DIRS for part in file_path.parts):
            continue
        if file_path.is_file() and file_path.suffix.lower() in VALID_EXTS:
            project_files.append(file_path)
            
            # Identify frontend files (JSX/TSX or located under client/frontend/src)
            rel_str = str(file_path).lower()
            if file_path.suffix.lower() in {".jsx", ".tsx"} or any(k in rel_str for k in ["src", "client", "frontend", "components", "pages"]):
                frontend_files.append(file_path)

    # Parse routes
    all_express_endpoints = parse_express_routes(project_files)
    used_api_urls = filter_api_urls_used_in_frontend(all_express_endpoints, frontend_files or project_files)
    web_urls = parse_react_routes(frontend_files or project_files)

    print("=" * 60)
    print("BACKEND API URLS (Implemented & Used in Frontend)")
    print("=" * 60)
    if used_api_urls:
        for url in used_api_urls:
            print(url)
    else:
        print("No implemented Express API URLs found matching frontend calls.")

    print("\n" + "=" * 60)
    print("FRONTEND WEB URLS (ReactJS)")
    print("=" * 60)
    if web_urls:
        for url in web_urls:
            print(url)
    else:
        print("No React Web URLs identified.")


if __name__ == "__main__":
    target_directory = sys.argv[1] if len(sys.argv) > 1 else "."
    main(target_directory)

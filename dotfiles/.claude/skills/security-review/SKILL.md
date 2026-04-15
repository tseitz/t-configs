---
name: security-review
description: Use this skill when adding authentication, handling user input, working with secrets, creating API endpoints, or implementing payment/sensitive features. Provides comprehensive security checklist and patterns.
---

# Security Review Skill

This skill ensures all code follows security best practices and identifies potential vulnerabilities.

## When to Activate

- Implementing authentication or authorization
- Handling user input or file uploads
- Creating new API endpoints
- Working with secrets or credentials
- Implementing payment features
- Storing or transmitting sensitive data
- Integrating third-party APIs

## Security Checklist

### 1. Secrets Management

#### FAIL: NEVER Do This
```
# Any language — hardcoded secrets
API_KEY = "sk-proj-xxxxx"
DB_PASSWORD = "password123"
```

#### PASS: ALWAYS Do This
```
# Read from environment at runtime
api_key = os.environ["API_KEY"]        # Python
apiKey = process.env.API_KEY           # Node.js
apiKey := os.Getenv("API_KEY")        # Go

# Fail fast if required secret is missing
if not api_key:
    raise RuntimeError("API_KEY not configured")
```

#### Verification Steps
- [ ] No hardcoded API keys, tokens, or passwords
- [ ] All secrets read from environment variables
- [ ] `.env` / `.env.local` in .gitignore
- [ ] No secrets in git history

### 2. Input Validation

#### Always Validate at System Boundaries
```
# Validate shape, type, and constraints before processing
schema = {
    email: string, format=email,
    name: string, min=1, max=100,
    age: integer, min=0, max=150
}

validated = schema.parse(user_input)  # raise on failure
```

#### File Upload Validation
```
def validate_upload(file):
    MAX_SIZE = 5 * 1024 * 1024  # 5MB
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif"}
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif"}

    if file.size > MAX_SIZE:
        raise ValueError("File too large")
    if file.content_type not in ALLOWED_TYPES:
        raise ValueError("Invalid file type")
    if file.extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Invalid file extension")
```

#### Verification Steps
- [ ] All user inputs validated with schemas
- [ ] File uploads restricted (size, type, extension)
- [ ] No direct use of user input in queries
- [ ] Whitelist validation (not blacklist)
- [ ] Error messages don't leak sensitive info

### 3. SQL Injection Prevention

#### FAIL: NEVER Concatenate SQL
```
# DANGEROUS
query = f"SELECT * FROM users WHERE email = '{user_email}'"
db.execute(query)
```

#### PASS: ALWAYS Use Parameterized Queries
```
# Safe — parameterized
db.execute("SELECT * FROM users WHERE email = %s", [user_email])

# ORM / query builder (also safe)
User.where(email: user_email).first
db.users.find_by(email: user_email)
```

#### Verification Steps
- [ ] All database queries use parameterized queries or ORM
- [ ] No string concatenation in SQL
- [ ] Raw SQL reviewed for injection risks

### 4. Authentication & Authorization

#### Token Storage
```
# FAIL: client-side storage (XSS-accessible)
localStorage.setItem('token', token)

# PASS: httpOnly cookie
Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=3600
```

#### Authorization Checks
```
# ALWAYS verify caller is authorized before acting
def delete_user(user_id, requester_id):
    requester = db.users.get(requester_id)
    if requester.role != "admin":
        raise PermissionError("Unauthorized")
    db.users.delete(user_id)
```

#### Verification Steps
- [ ] Tokens stored in httpOnly cookies (not localStorage)
- [ ] Authorization checks before every sensitive operation
- [ ] Row-level or resource-level access control enforced
- [ ] Role-based access control implemented
- [ ] Session management secure

### 5. XSS Prevention

#### Sanitize User-Provided HTML
```
# Before rendering user HTML, sanitize it
clean_html = sanitize(user_html, allowed_tags=["b", "i", "em", "p"])
```

#### Content Security Policy
```
# HTTP response header
Content-Security-Policy: default-src 'self'; script-src 'self'; img-src 'self' data: https:;
```

#### Verification Steps
- [ ] User-provided HTML sanitized before rendering
- [ ] CSP headers configured
- [ ] No unvalidated dynamic content in HTML context
- [ ] Framework auto-escaping enabled (not bypassed)

### 6. CSRF Protection

#### CSRF Tokens
```
# On POST/PUT/DELETE: verify token from request header matches session
token = request.headers.get("X-CSRF-Token")
if not csrf.verify(token, session):
    return 403 Forbidden
```

#### SameSite Cookies
```
Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Strict
```

#### Verification Steps
- [ ] CSRF tokens on all state-changing operations
- [ ] SameSite=Strict on session cookies
- [ ] Double-submit cookie pattern or equivalent

### 7. Rate Limiting

#### Apply Limits to Sensitive Endpoints
```
# Principle: sliding window with IP + user-based limiting
# Standard endpoints: 100 req / 15 min
# Expensive / auth endpoints: 10 req / 1 min
# Implement at gateway, middleware, or application layer
```

#### Verification Steps
- [ ] Rate limiting on auth and expensive endpoints
- [ ] Stricter limits on search and AI-backed routes
- [ ] Returns 429 with Retry-After header

### 8. Sensitive Data Exposure

#### Logging
```
# FAIL: logging sensitive fields
log.info("login", email=email, password=password)

# PASS: log only non-sensitive identifiers
log.info("login", email=email, user_id=user_id)
```

#### Error Messages
```
# FAIL: leaking internals
return 500, {"error": str(exception), "trace": traceback}

# PASS: generic user message, detailed server log
log.error("Internal error", exc_info=True)
return 500, {"error": "An error occurred. Please try again."}
```

#### Verification Steps
- [ ] No passwords, tokens, or secrets in logs
- [ ] Error messages are generic for external callers
- [ ] Stack traces never exposed to users
- [ ] PII fields redacted in logs

### 9. Dependency Security

Run the appropriate audit tool for the project stack:

```bash
npm audit --audit-level=high   # Node.js
pip-audit                      # Python
cargo audit                    # Rust
govulncheck ./...              # Go
bundle audit                   # Ruby
```

#### Verification Steps
- [ ] No known vulnerabilities in direct dependencies
- [ ] Lock files committed and used in CI (`npm ci`, `pip install --require-hashes`, etc.)
- [ ] Dependabot or equivalent enabled
- [ ] Regular updates scheduled

## Security Testing

Write tests that verify security behavior — not just happy paths:

```
# Authentication required
assert GET /api/protected → 401 when unauthenticated

# Authorization enforced
assert DELETE /api/resource → 403 when caller lacks permission

# Input validation
assert POST /api/users (invalid email) → 400

# Rate limiting
assert 101 rapid requests → at least one 429
```

## Pre-Deployment Security Checklist

Before ANY production deployment:

- [ ] **Secrets**: No hardcoded secrets, all in env vars
- [ ] **Input Validation**: All user inputs validated
- [ ] **SQL Injection**: All queries parameterized
- [ ] **XSS**: User content sanitized, CSP configured
- [ ] **CSRF**: Protection enabled on state-changing routes
- [ ] **Authentication**: Secure token handling
- [ ] **Authorization**: Role / resource checks in place
- [ ] **Rate Limiting**: Enabled on auth and expensive endpoints
- [ ] **HTTPS**: Enforced in production
- [ ] **Error Handling**: No sensitive data in error responses
- [ ] **Logging**: No sensitive data logged
- [ ] **Dependencies**: Audit clean, lock files committed
- [ ] **CORS**: Properly configured
- [ ] **File Uploads**: Validated (size, type, extension)

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Security Academy](https://portswigger.net/web-security)

---

**Remember**: Security is not optional. One vulnerability can compromise the entire platform. When in doubt, err on the side of caution.

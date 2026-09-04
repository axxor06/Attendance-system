from pathlib import Path

import yaml

spec = yaml.safe_load(Path(__file__).resolve().parents[1].joinpath('docs/openapi.yaml').read_text())
assert spec['openapi'] == '3.1.0'
assert '/auth/login' in spec['paths']
assert '/auth/reset-password' in spec['paths']
assert '/classes' in spec['paths']
assert '/attendance/history' in spec['paths']
assert '/reports/class/{classId}/monthly' in spec['paths']
assert spec['components']['securitySchemes']['refreshCookie']['in'] == 'cookie'
assert spec['components']['parameters']['Limit']['schema']['maximum'] == 100
assert 'Retry-After' in spec['paths']['/auth/login']['post']['responses']['429']['$ref'] or spec['paths']['/auth/login']['post']['responses']['429']['$ref'] == '#/components/responses/RateLimited'
print(f"OpenAPI parsed successfully: {len(spec['paths'])} documented paths")

"""Apply only the reviewed visibility fix to the distinct public server baseline.

Input is an API-downloaded public phone-role-push/index.ts. Output lives in a
separate deployment workspace; private batch-unlock policy is not copied over.
"""
from pathlib import Path
from hashlib import sha256
import sys

baseline = Path(sys.argv[1]).read_text(encoding="utf-8")
assert sha256(baseline.encode()).hexdigest() == "e1f6ff604bb2d9a832ea854cd1e5d0aad11e39df8f6b8f36ea022601bf99f384", "public server changed; re-review before deploying"
root = Path(__file__).resolve().parents[1]
current = (root / "supabase/functions/phone-role-push/index.ts").read_text(encoding="utf-8")
start = current.index("function roleNotificationBody(")
end = current.index("\n}", start) + 2
old_start = baseline.index("function roleNotificationBody(")
old_end = baseline.index("\n}", old_start) + 2
patched = baseline[:old_start] + current[start:end] + baseline[old_end:]
start = current.index("  // App-decision protocol is never chat content")
end = current.index("  const { data: outbox, error }", start)
insert = patched.index("  const { data: outbox, error }", patched.index("async function persistAndPush("))
patched = patched[:insert] + current[start:end] + patched[insert:]
assert "roleManualUnlockFailureResult" not in patched
output = Path(sys.argv[2]) / "supabase/functions/phone-role-push/index.ts"
output.parent.mkdir(parents=True, exist_ok=True)
assert not output.exists(), "do not overwrite a deployment candidate"
output.write_text(patched, encoding="utf-8", newline="\n")
policy = Path(sys.argv[1]).parent.parent / "_shared/public-north-policy.js"
policy_bytes = policy.read_bytes()
assert sha256(policy_bytes).hexdigest() == "fe0db81aafc38d4ac5bb623e87ffccc0c61a456fd926010e7e84cb5fe5638514"
policy_output = output.parent.parent / "_shared/public-north-policy.js"
policy_output.parent.mkdir(parents=True, exist_ok=True)
policy_output.write_bytes(policy_bytes)
print("public candidate SHA256:", sha256(patched.encode()).hexdigest())

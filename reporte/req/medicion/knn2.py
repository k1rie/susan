import sys, time
sys.path.insert(0, '/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/recognition-service')
import numpy as np
from app.index import LoadedIndex, IndexPayload
DIM = 512
def build(n, seed=1):
    rng = np.random.default_rng(seed)
    v = rng.standard_normal((n, DIM)).astype(np.float32)
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    return v, LoadedIndex(IndexPayload('v', DIM, 'm', 'x', np.arange(n, dtype=np.int64), v)), rng
def medir(n, nq, nallowed, reps=300):
    v, idx, rng = build(n)
    allowed = rng.choice(n, nallowed, replace=False).tolist()
    q = v[allowed[:nq]]
    idx.search(q, allowed)
    t = []
    for _ in range(reps):
        a = time.perf_counter(); idx.search(q, allowed); t.append((time.perf_counter()-a)*1000)
    t = np.array(t)
    return dict(n=n, consultas=nq, permitidos=nallowed, p50=round(float(np.percentile(t,50)),3), p95=round(float(np.percentile(t,95)),3))
for nq, na in [(1,50),(60,60)]:
    a = medir(5000, nq, na); b = medir(20000, nq, na)
    print(a); print(b); print('razon p50', round(b['p50']/a['p50'],2), 'razon p95', round(b['p95']/a['p95'],2))

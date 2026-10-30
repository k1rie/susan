import sys, time
sys.path.insert(0, '/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/recognition-service')
import numpy as np
from app.index import IndexPayload, dump_index, parse_index, LoadedIndex, now_iso
DIM=512
for n in (5000, 20000):
    rng = np.random.default_rng(2)
    v = rng.standard_normal((n, DIM)).astype(np.float32); v /= np.linalg.norm(v, axis=1, keepdims=True)
    p = IndexPayload('v1', DIM, 'm', now_iso(), np.arange(n, dtype=np.int64), v)
    t=time.perf_counter(); raw = dump_index(p); t1=time.perf_counter()-t
    t=time.perf_counter(); q = parse_index(raw, DIM); t2=time.perf_counter()-t
    t=time.perf_counter(); LoadedIndex(q); t3=time.perf_counter()-t
    print(n, 'MB=%.1f' % (len(raw)/1e6), 'dump=%.2fs parse=%.2fs cargar_faiss=%.2fs' % (t1,t2,t3))

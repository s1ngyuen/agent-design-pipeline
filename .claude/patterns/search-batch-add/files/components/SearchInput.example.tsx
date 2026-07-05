'use client';
import { useRef, useState } from 'react';
import { searchCatalog, type CatalogItem } from '@/lib/searchIndex';
import { useBatchAdd } from '@/hooks/useBatchAdd';

// Debounce helper — collapses rapid keystrokes into one search instead of
// one per character. Lesson learned: an un-debounced search over a large
// static array causes real, perceptible typing lag (see README).
function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export default function SearchInput() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [staged, setStaged] = useState<CatalogItem[]>([]);
  const [committing, setCommitting] = useState(false);
  const { batchAdd } = useBatchAdd();

  const runSearch = useRef(
    debounce((val: string) => setResults(searchCatalog(val)), 150),
  ).current;

  function onInputChange(val: string) {
    setQuery(val);
    if (val.trim().length < 2) {
      setResults([]);
      return;
    }
    runSearch(val);
  }

  function stageItem(item: CatalogItem) {
    setStaged(prev => (prev.some(i => i.id === item.id) ? prev : [...prev, item]));
    setQuery('');
    setResults([]);
  }

  // Staged items are committed as ONE batch, not one call per item — see
  // useBatchAdd's Lessons Learned for why a loop of individual calls is unsafe.
  async function commit() {
    setCommitting(true);
    try {
      await batchAdd(staged.map(i => i.id));
      setStaged([]);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div>
      <input
        value={query}
        onChange={e => onInputChange(e.target.value)}
        placeholder="Search…"
        aria-label="Search"
      />
      {results.length > 0 && (
        <ul role="listbox" aria-label="Matching results">
          {results.map(r => (
            <li key={r.id} role="option" tabIndex={0} onClick={() => stageItem(r)}>
              {r.name}
            </li>
          ))}
        </ul>
      )}
      {staged.length > 0 && (
        <div>
          <ul>
            {staged.map(s => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
          <button type="button" onClick={commit} disabled={committing}>
            {committing ? 'Saving…' : `Add ${staged.length} item${staged.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}

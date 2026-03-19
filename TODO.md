# TODO

Implementation-level notes and future improvements, below the level of PROPOSAL.md.

## Library

- Add a clear (×) button to the search field
- Avoid loading the full library into memory — serve rows directly from IndexedDB to the virtualizer on demand, so the page is fast even with very large libraries

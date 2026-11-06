# Games

A small collection of open-source browser games vendored into this repository so they
can be run without installing dependencies.

## 2048

- Location: [`games/2048/`](2048/)
- Source: [gabrielecirulli/2048](https://github.com/gabrielecirulli/2048)
- License: [MIT](2048/LICENSE.txt)

Run it with any static file server from the repository root:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/games/2048/>.

The game is an unmodified snapshot of upstream commit
[`478b6ec`](https://github.com/gabrielecirulli/2048/commit/478b6ec346e3787f589e4af751378d06ded4cbbc).
See [NOTICE.md](2048/NOTICE.md) for attribution details.

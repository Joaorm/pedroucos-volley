#!/usr/bin/env python3
"""Builds the Vercel create_deployment requestBody with the site files inlined (base64).

The attendance API needs a git deployment so Vercel installs @vercel/blob.
Prefer pushing to main. This payload is only a fallback for the same project.
"""
import base64, json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
files = [
    "index.html",
    "jogos.html",
    "site.css",
    "fonts/barlow-condensed-700.woff2",
    "fonts/barlow-condensed-800.woff2",
    "schedule.js",
    "data.json",
    "vercel.json",
    "package.json",
    "package-lock.json",
    "api/presencas.js",
    "logo.png",
    "logo-180.png",
]
body = {
    "name": "cspedroucos-volley",
    "project": "cspedroucos-volley",
    "target": "production",
    "files": [{"file": f, "encoding": "base64", "data": base64.b64encode(open(os.path.join(here, f), "rb").read()).decode()} for f in files],
    "projectSettings": {"framework": None, "buildCommand": None, "installCommand": None, "outputDirectory": None},
}
out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/volley-deploy.json"
json.dump(body, open(out, "w"))
print(out, os.path.getsize(out), "bytes", file=sys.stderr)

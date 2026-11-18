#!/usr/bin/env python3
"""Builds the Vercel create_deployment requestBody with all site files inlined (base64)."""
import base64, json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
files = ["index.html", "data.json", "vercel.json", "logo.png", "logo-180.png"]
body = {
    "name": "pedroucos-volley",
    "project": "pedroucos-volley",
    "target": "production",
    "files": [{"file": f, "encoding": "base64", "data": base64.b64encode(open(os.path.join(here, f), "rb").read()).decode()} for f in files],
    "projectSettings": {"framework": None, "buildCommand": None, "installCommand": None, "outputDirectory": None},
}
out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/volley-deploy.json"
json.dump(body, open(out, "w"))
print(out, os.path.getsize(out), "bytes")

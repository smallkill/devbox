import json
from playwright.sync_api import sync_playwright

LOG = "/home/derek/projects/devbox/site/outputs/status_diag/final_runs/run_1/final_script_log.txt"
SHOTS = "/home/derek/projects/devbox/site/outputs/status_diag/final_runs/run_1/screenshots"

def logline(s):
    with open(LOG, "a") as f:
        f.write(s + "\n")
    print(s)

open(LOG, "w").close()

console_msgs = []
page_errors = []
requests = []
responses = []
failed = []

with sync_playwright() as p:
    browser = p.firefox.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 1800})
    page = ctx.new_page()

    page.on("console", lambda m: console_msgs.append((m.type, m.text, str(m.location))))
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.on("request", lambda r: requests.append((r.method, r.url)))
    page.on("response", lambda r: responses.append((r.status, r.url)))
    page.on("requestfailed", lambda r: failed.append((r.url, str(r.failure))))

    logline("step 1 action: navigate to /status/")
    page.goto("https://derek-chen.pages.dev/status/", wait_until="load", timeout=60000)

    logline("step 2 action: wait 12s for client JS fetch")
    page.wait_for_timeout(12000)

    page.screenshot(path=f"{SHOTS}/final_execution_2_status.png")

    # Capture visible state of key metrics by scanning text
    def txt(sel):
        try:
            el = page.query_selector(sel)
            return el.inner_text().strip() if el else "<<not found>>"
        except Exception as e:
            return f"<<err {e}>>"

    body_text = page.inner_text("body")
    logline("=== STATUS PAGE BODY TEXT (truncated 4000) ===")
    logline(body_text[:4000])

    logline("=== CONSOLE MESSAGES (status) ===")
    for t, text, loc in console_msgs:
        logline(f"[{t}] {text}  @ {loc}")

    logline("=== PAGE ERRORS (status) ===")
    for e in page_errors:
        logline(e)

    logline("=== STATS API RESPONSES ===")
    for status, url in responses:
        if "workers.dev" in url or "stats" in url or "flagcdn" in url:
            logline(f"{status}  {url}")

    logline("=== FAILED REQUESTS (status) ===")
    for url, fail in failed:
        logline(f"FAILED {url} -- {fail}")

    logline("=== ALL REQUESTS to workers.dev / flagcdn ===")
    for m, url in requests:
        if "workers.dev" in url or "flagcdn" in url:
            logline(f"{m} {url}")

    # Now homepage
    console_msgs2 = []
    page_errors2 = []
    failed2 = []
    page2 = ctx.new_page()
    page2.on("console", lambda m: console_msgs2.append((m.type, m.text)))
    page2.on("pageerror", lambda e: page_errors2.append(str(e)))
    page2.on("requestfailed", lambda r: failed2.append((r.url, str(r.failure))))
    logline("step 3 action: navigate to homepage /")
    page2.goto("https://derek-chen.pages.dev/", wait_until="load", timeout=60000)
    page2.wait_for_timeout(5000)
    page2.screenshot(path=f"{SHOTS}/final_execution_3_home.png")

    logline("=== CONSOLE MESSAGES (home) ===")
    for t, text in console_msgs2:
        logline(f"[{t}] {text}")
    logline("=== PAGE ERRORS (home) ===")
    for e in page_errors2:
        logline(e)
    logline("=== FAILED REQUESTS (home) ===")
    for url, fail in failed2:
        logline(f"FAILED {url} -- {fail}")

    browser.close()

logline("DONE")

from playwright.sync_api import sync_playwright
import os, json
OUT=os.path.join(os.path.dirname(__file__),'shots'); os.makedirs(OUT,exist_ok=True)
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in [(1280,860),(390,844)]:
        pg=b.new_page(viewport={'width':w,'height':h})
        pg.on('pageerror',lambda e: errs.append(f'PAGEERR {e}'))
        pg.on('console',lambda m: errs.append('console:'+m.text) if m.type=='error' and 'fonts' not in m.text and '403' not in m.text else None)
        pg.goto('file://'+os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','app.html')); pg.wait_for_timeout(700)
        pg.screenshot(path=f'{OUT}/{w}_life.png')
        roles=pg.evaluate("DB.list('roles').map(r=>r.id)")
        sheets=pg.evaluate("TABS.filter(t=>t!=='|')")
        for rid in roles:
            pg.select_option('#roleSel',rid); pg.wait_for_timeout(120)
            for s in sheets:
                pg.evaluate(f"navigate({{s:'{s}'}})"); pg.wait_for_timeout(60)
                # expand every row
                n=pg.evaluate(f"document.querySelectorAll('.ws[data-sheet=\"{s}\"] tr[data-row] .tg').length")
                for i in range(n):
                    pg.evaluate(f"(()=>{{const b=document.querySelectorAll('.ws[data-sheet=\"{s}\"] tr[data-row] .tg')[{i}]; if(b && b.getAttribute('aria-expanded')==='false') b.click();}})()")
                # sort each column
                nc=pg.evaluate(f"document.querySelectorAll('.ws[data-sheet=\"{s}\"] thead .sh[data-act=sort]').length")
                for c in range(nc):
                    pg.evaluate(f"document.querySelectorAll('.ws[data-sheet=\"{s}\"] thead .sh[data-act=sort]')[{c}].click()")
                pg.evaluate(f"UI.open['{s}']=new Set(); if(UI.sheets['{s}']) UI.sheets['{s}'].col=null;")
            # life months
            pg.evaluate("navigate({s:'life'})")
            cells=pg.evaluate("[...document.querySelectorAll('.ws.life td.c.has button')].map(b=>[b.dataset.y,b.dataset.m])")
            for y,m in cells:
                pg.evaluate(f"ACT.calOpen({{dataset:{{y:'{y}',m:'{m}'}}}})")
            pg.evaluate("UI.calMonth=null")
        # click every jump link on problems sheet as 阿澄
        pg.select_option('#roleSel',roles[0]); pg.wait_for_timeout(100)
        pg.evaluate("navigate({s:'challenges'})"); pg.wait_for_timeout(100)
        pg.screenshot(path=f'{OUT}/{w}_challenges.png')
        pg.evaluate("navigate({s:'problems'})"); pg.wait_for_timeout(100)
        pg.screenshot(path=f'{OUT}/{w}_problems.png')
        links=pg.evaluate("document.querySelectorAll('.ws[data-sheet=problems] .lk').length")
        for i in range(min(links,40)):
            pg.evaluate("navigate({s:'problems'})"); pg.wait_for_timeout(40)
            pg.evaluate(f"(()=>{{const l=document.querySelectorAll('.ws[data-sheet=problems] .lk')[{i}]; if(l) l.click();}})()"); pg.wait_for_timeout(60)
            pg.evaluate("document.getElementById('backBtn').click()"); pg.wait_for_timeout(40)
        pg.evaluate("navigate({s:'stations'})"); pg.wait_for_timeout(100)
        pg.screenshot(path=f'{OUT}/{w}_stations.png')
        pg.evaluate("navigate({s:'rules'})"); pg.wait_for_timeout(100)
        pg.click('[data-act=ruleEdit]'); pg.wait_for_timeout(150)
        pg.screenshot(path=f'{OUT}/{w}_rules_edit.png')
        pg.evaluate("ACT.ruleCancel()")
        pg.evaluate("navigate({s:'paths'})"); pg.wait_for_timeout(100)
        print(w, 'paths rows', pg.evaluate("document.querySelectorAll('.ws[data-sheet=paths] tr[data-row]').length"))
        pg.close()
    b.close()
print('\n'.join(errs[:30]) or 'no errors')

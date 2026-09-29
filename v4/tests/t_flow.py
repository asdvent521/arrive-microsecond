from playwright.sync_api import sync_playwright
import os
OUT=os.path.join(os.path.dirname(__file__),'shots'); os.makedirs(OUT,exist_ok=True)
errs=[]; log=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e: errs.append(f'PAGEERR {e}'))
    pg.goto('file://'+os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','app.html')); pg.wait_for_timeout(600)
    A,B,C,D,E=pg.evaluate("DB.list('roles').map(r=>r.id)")
    Y=pg.evaluate("DB.list('stations').find(s=>s.status==='open').point")
    parts=pg.evaluate(f"usParts({Y})")
    def dlg(): 
        t=pg.inner_text('#dlgBody') if pg.evaluate("document.getElementById('dlg').open") else ''
        return t.replace('\n',' ')[:90]
    # 阿凱: open problems sheet, click 寫下出發點 (next column) -> drawer opens
    pg.select_option('#roleSel',D); pg.wait_for_timeout(100)
    pg.click('.tabs a[data-s=problems]'); pg.wait_for_timeout(150)
    pg.click('.ws[data-sheet=problems] [data-act=jump][data-open="1"]'); pg.wait_for_timeout(200)
    for k in ['y','mo','d','h','mi','s']: pg.fill(f'[name=pt_{k}]',str(parts[k]))
    pg.fill('[name=pt_micro]',str(parts['micro']).zfill(6))
    pg.click('[data-act=writeDep]'); pg.wait_for_timeout(200)
    log.append('D write: '+dlg())
    pg.click('#dlgFoot .pri'); pg.wait_for_timeout(250)
    log.append('now sheet: '+pg.evaluate("UI.sheet")+' open='+str(pg.evaluate("[...(UI.open.stations||[])]")))
    # 阿澄 docks via stations drawer
    pg.select_option('#roleSel',A); pg.wait_for_timeout(100)
    pg.click('.tabs a[data-s=todo]'); pg.wait_for_timeout(150)
    todo=pg.inner_text('[data-simple=todo]')
    log.append('todo has 對接: '+str('對接' in todo))
    pg.click('[data-simple=todo] tr:has-text("對接") .lk'); pg.wait_for_timeout(250)
    log.append('dock sheet: '+pg.evaluate("UI.sheet"))
    for cb in pg.query_selector_all('form[data-st] [name="consent[]"]'): cb.check()
    pg.click('[data-act=dock][data-ok="1"]'); pg.wait_for_timeout(300)
    log.append('after dock sheet: '+pg.evaluate("UI.sheet")+'; subject: '+str(pg.evaluate(f"DB.list('stations').find(s=>s.point==={Y}).subject.map(roleName)")))
    pg.screenshot(path=f'{OUT}/flow_fusion.png')
    # add challenge via add row on VI
    pg.click('.tabs a[data-s=challenges]'); pg.wait_for_timeout(150)
    stId=pg.evaluate(f"DB.list('stations').find(s=>s.point==={Y}).id")
    pg.select_option('.ws tr.addrow select[name=st]', stId); pg.wait_for_timeout(200)
    pg.fill('.ws tr.addrow input[name=content]','一起訂出白天的開工時間')
    for cb in pg.query_selector_all('.ws tr.addrow [name="consent[]"]'): cb.check()
    pg.click('[data-act=addCh]'); pg.wait_for_timeout(250)
    log.append('add challenge err: '+dlg())
    cid=pg.evaluate("DB.list('challenges').find(c=>c.content==='一起訂出白天的開工時間')?.id")
    log.append('challenge created: '+str(bool(cid)))
    # 阿凱 accepts & submits; 阿澄 judges
    pg.select_option('#roleSel',D); pg.wait_for_timeout(100)
    pg.evaluate(f"navigate({{s:'challenges',id:'{cid}'}})"); pg.wait_for_timeout(150)
    pg.click(f'[data-act=acceptCh][data-ch="{cid}"]'); pg.wait_for_timeout(150)
    pg.click(f'[data-act=submitCh][data-ch="{cid}"]'); pg.wait_for_timeout(150)
    pg.select_option('#roleSel',A); pg.wait_for_timeout(100)
    pg.evaluate(f"navigate({{s:'challenges',id:'{cid}'}})"); pg.wait_for_timeout(150)
    pg.click(f'[data-act=judgeOk][data-ch="{cid}"]'); pg.wait_for_timeout(150)
    log.append('challenge status: '+pg.evaluate(f"DB.get('challenges','{cid}').status"))
    # 阿澄 uses a batch from VIII to book
    pg.click('.tabs a[data-s=batches]'); pg.wait_for_timeout(150)
    pg.click('[data-act=useBatch] >> nth=0'); pg.wait_for_timeout(250)
    log.append('bk sheet: '+pg.evaluate("UI.sheet")+' quote: '+pg.inner_text('.ws tr.addrow td:nth-child(8)').replace('\n',' '))
    pg.click('[data-act=book]'); pg.wait_for_timeout(250)
    log.append('book err: '+dlg())
    if dlg(): pg.click('#dlgFoot button')
    log.append('bookings: '+pg.evaluate("DB.list('bookings').map(b=>b.result).join(',')"))
    # fast forward 7 days
    pg.click('.tabs a[data-s=settings]'); pg.wait_for_timeout(150)
    pg.click(f'[data-act=sim][data-d="{7*86400000000}"]'); pg.wait_for_timeout(300)
    log.append('after sim bookings: '+pg.evaluate("DB.list('bookings').map(b=>b.result).join(',')")+' stations: '+pg.evaluate("DB.list('stations').map(s=>s.status).join(',')"))
    # rules inline edit & save
    pg.click('.tabs a[data-s=rules]'); pg.wait_for_timeout(150)
    pg.click('[data-act=ruleEdit]'); pg.wait_for_timeout(150)
    pg.fill('input[name=qKcal]','120'); pg.fill('input[name=note]','調高題點')
    pg.click('[data-act=saveRules]'); pg.wait_for_timeout(250)
    log.append('rule ver: '+str(pg.evaluate(f"currentVersion('{A}').no"))+' edit='+str(pg.evaluate("UI.ruleEdit")))
    # add role and tail via add rows
    pg.click('.tabs a[data-s=tails]'); pg.wait_for_timeout(150)
    pg.fill('.ws tr.addrow input[name=s]','42'); pg.fill('.ws tr.addrow input[name=u]','031415'); pg.fill('.ws tr.addrow input[name=l]','測試')
    pg.click('[data-act=addTail]'); pg.wait_for_timeout(150)
    log.append('tails: '+str(pg.evaluate(f"DB.list('tails',t=>t.roleId==='{A}').length")))
    # problem add row -> navigates with drawer open
    pg.click('.tabs a[data-s=problems]'); pg.wait_for_timeout(150)
    pg.fill('.ws tr.addrow input[name=name]','新的測試難題'); pg.click('[data-act=addProblem]'); pg.wait_for_timeout(250)
    log.append('new problem drawer open: '+str(pg.evaluate("[...(UI.open.problems||[])].length")))
    pg.screenshot(path=f'{OUT}/flow_newprob.png')
    # back button chain
    for i in range(3): pg.click('#backBtn'); pg.wait_for_timeout(120)
    log.append('after back x3: '+pg.evaluate("UI.sheet"))
    # paths export & paper preview
    pg.evaluate("navigate({s:'paths'})"); pg.wait_for_timeout(120)
    pg.click('[data-act=exportPaths]'); pg.wait_for_timeout(300)
    log.append('paths dlg: '+str(pg.evaluate("document.getElementById('dlg').open")))
    if pg.evaluate("document.getElementById('dlg').open"): pg.click('#dlgFoot button')
    pg.evaluate("navigate({s:'paper'})"); pg.wait_for_timeout(120)
    pg.click('[data-act=pvw][data-k=handbook]'); pg.wait_for_timeout(250)
    log.append('handbook pages: '+str(pg.evaluate("document.querySelectorAll('#preview .page').length")))
    # timeline
    pg.evaluate("navigate({s:'timeline'})"); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}/flow_timeline.png')
    b.close()
print('\n'.join(log)); print('\n'.join(errs) or 'no page errors')

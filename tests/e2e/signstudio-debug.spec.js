import {test,expect} from '@playwright/test';
test('production shell and assets load from the GitHub Pages base path',async({page})=>{
 const failed=[];page.on('requestfailed',r=>{if(new URL(r.url()).origin==='http://127.0.0.1:4173')failed.push(r.url());});
 const response=await page.goto('./');expect(response?.ok()).toBeTruthy();
 await expect(page.getByRole('heading',{name:/work with your files/i})).toBeVisible();
 await expect(page.getByRole('button',{name:/signature photo cleaner/i})).toBeVisible();
 await expect(page.getByRole('button',{name:/pdf filler/i})).toBeVisible();
 expect(failed).toEqual([]);expect(new URL(page.url()).pathname).toBe('/SignStudio/');
});
test('application does not use persistent browser storage or service workers',async({page})=>{
 await page.addInitScript(()=>{const audit={localStorage:[],sessionStorage:[],indexedDB:[],serviceWorkers:[]};Object.defineProperty(window,'__signStudioStorageAudit',{value:audit});const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){audit[this===localStorage?'localStorage':'sessionStorage'].push(String(k));return set.call(this,k,v);};const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(n,...a){audit.indexedDB.push(String(n));return open.call(this,n,...a);};if(navigator.serviceWorker?.register)navigator.serviceWorker.register=()=>{audit.serviceWorkers.push('register');return Promise.reject(new Error('Not allowed in this app'));};});
 await page.goto('./');const audit=await page.evaluate(()=>window.__signStudioStorageAudit);
 expect(audit.localStorage).toEqual([]);expect(audit.sessionStorage).toEqual([]);expect(audit.indexedDB).toEqual([]);expect(audit.serviceWorkers).toEqual([]);
});
test('legacy persistent library, profiles, passwords and backups are not exposed',async({page})=>{
 await page.goto('./');await expect(page.getByRole('heading',{name:/work with your files/i})).toBeVisible();
 await expect(page.getByText(/my signatures|saved details|backup password|app password/i)).toHaveCount(0);
 await expect(page.getByRole('button',{name:/signature photo cleaner/i})).toBeVisible();
});
test('PDF tool has no handwritten signature placement workflow',async({page})=>{
 await page.goto('./');await page.getByRole('button',{name:/pdf filler/i}).click();
 await expect(page.getByRole('heading',{name:/fill and edit pdf documents/i})).toBeVisible();
 await expect(page.getByText(/add your signature|saved signature|signature library/i)).toHaveCount(0);
 await expect(page.getByLabel(/choose pdf/i)).toHaveAttribute('accept',/application\\/pdf/);
});

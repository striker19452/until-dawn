// Use the same sections through the compact phone menu or the desktop sidebar.
export async function openTab(page,tab){
 if(await page.locator('[data-action=close-overlay]').isVisible())await page.locator('[data-action=close-overlay]').click();
 const direct=page.locator(`#nav [data-tab=${tab}]`);
 if(await direct.isVisible()){await direct.click();return;}
 if(tab==='yard'){if(await page.locator('[data-action=close-overlay]').isVisible())await page.locator('[data-action=close-overlay]').click();return;}
 await page.getByRole('button',{name:'打开游戏菜单'}).click();
 await page.locator(`#sheet-body [data-panel=${tab}]`).click();
}
export async function openReady(page){
 const entry=page.locator('[data-action=drawer][data-panel=ready]').filter({visible:true});
 if(!await entry.count())await page.getByRole('button',{name:'打开游戏菜单'}).click();
 await page.locator('[data-action=drawer][data-panel=ready]').filter({visible:true}).click();
}
export async function selectZone(page,zone){
 if(await page.locator('#battle-zone').isVisible()){await page.locator('#battle-zone').selectOption(zone);return;}
 const direct=page.locator(`#zones [data-zone=${zone}]`);
 if(await direct.isVisible()){await direct.click();return;}
 if(!await page.locator('#defense-zone').isVisible()){
  await page.getByRole('button',{name:'打开游戏菜单'}).click();await page.locator('#sheet-body [data-panel=defense]').click();
 }
 await page.locator('#defense-zone').selectOption(zone);
}

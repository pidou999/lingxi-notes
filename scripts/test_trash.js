const base = 'http://localhost:8888/api/v1';

async function main() {
  const login = await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test',password:'test123'})}).then(r=>r.json());
  const h = {headers:{'Authorization':'Bearer '+login.token,'Content-Type':'application/json'}};

  // Create
  let r = await fetch(base+'/notes',{...h,method:'POST',body:JSON.stringify({id:'trash-t',title:'回收站测试',html:'<p>t</p>',json:'{}',tags:'["test"]'})}).then(r=>r.json());
  console.log('Create:', r.id, r.tags);

  // Soft delete
  r = await fetch(base+'/notes/trash-t',{...h,method:'DELETE'}).then(r=>r.json());
  console.log('Delete:', JSON.stringify(r));

  // List trash
  r = await fetch(base+'/trash',{...h}).then(r=>r.json());
  console.log('Trash list:', r.length, r[0]?.title, r[0]?.deletedAt?.substring(0,19));

  // Restore
  r = await fetch(base+'/trash/trash-t/restore',{...h,method:'POST'}).then(r=>r.json());
  console.log('Restore:', JSON.stringify(r));

  // List notes
  r = await fetch(base+'/notes',{...h}).then(r=>r.json());
  console.log('Notes has restored:', r.some(n=>n.id==='trash-t'));

  // Soft delete again
  await fetch(base+'/notes/trash-t',{...h,method:'DELETE'});
  
  // Permanent delete
  r = await fetch(base+'/trash/trash-t',{...h,method:'DELETE'}).then(r=>r.json());
  console.log('Permanent:', JSON.stringify(r));

  // Verify gone
  r = await fetch(base+'/trash',{...h}).then(r=>r.json());
  console.log('Trash final:', r.length);

  // Clean expired
  r = await fetch(base+'/trash/clean',{...h,method:'POST'}).then(r=>r.json());
  console.log('Clean:', JSON.stringify(r));
}
main().catch(e=>console.log('Err:', e));

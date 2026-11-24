window.claude={use:async(name)=>{
  const load=()=>{try{return JSON.parse(localStorage.getItem('mockdb')||'{}')}catch(e){return{}}};
  const store=o=>localStorage.setItem('mockdb',JSON.stringify(o));
  const subs=[];
  const emit=()=>{const snapState=JSON.parse(JSON.stringify(load()));
    // deliver with random delay so echoes arrive late / out of order
    subs.forEach(cb=>setTimeout(()=>cb({docs:Object.entries(snapState).map(([id,d])=>({id,data:()=>JSON.parse(JSON.stringify(d))}))}),50+Math.random()*900));};
  if(name==='user') return {id:async()=>'u1'};
  if(name==='db') return {collection:(p)=>({onSnapshot:(cb)=>{subs.push(cb);emit();return()=>{}},
     doc:(id)=>({set:async(d)=>{await new Promise(r=>setTimeout(r,Math.random()*300));const s=load();s[id]=d;store(s);emit();},
                 update:async(d)=>{await new Promise(r=>setTimeout(r,Math.random()*300));const s=load();if(!s[id])throw new Error('not found');Object.assign(s[id],d);store(s);emit();}})})};
  return null;}};

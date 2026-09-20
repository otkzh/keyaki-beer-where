(()=>{
  const map=document.querySelector('#map'),layer=document.querySelector('#mapLayer'),pin=document.querySelector('#pin'),bubble=document.querySelector('#bubble');
  const status=document.querySelector('#status'),toast=document.querySelector('#toast');
  let pos=JSON.parse(localStorage.getItem('keyaki-pin')||'null')||{x:.5,y:.5};
  function setPos(x,y,save=true){pos={x:Math.max(.025,Math.min(.975,x)),y:Math.max(.12,Math.min(.94,y))};pin.style.left=bubble.style.left=(pos.x*100)+'%';pin.style.top=bubble.style.top=(pos.y*100)+'%';if(save)localStorage.setItem('keyaki-pin',JSON.stringify(pos));}
  function say(t){toast.textContent=t;toast.classList.add('on');clearTimeout(say.t);say.t=setTimeout(()=>toast.classList.remove('on'),1800)}
  function clock(){const d=new Date;document.querySelector('#clock').textContent=d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})} clock();setInterval(clock,30000);setPos(pos.x,pos.y,false);
  let view={scale:1,tx:0,ty:0},pointers=new Map(),gesture=null;
  const markerSize=42,markerButton=document.querySelector('#markerButton'),emojiPin=pin.querySelector('.emoji-symbol');
  const markerShapes=['pin','mug','bottle','cheers','pretzel','sausage','fries','cheese','nuts','party'];
  const markerNames={pin:'ピン',mug:'ビールジョッキ',bottle:'ビール瓶',cheers:'乾杯',pretzel:'プレッツェル',sausage:'ソーセージ',fries:'ポテト',cheese:'チーズ',nuts:'ナッツ',party:'お祭り'};
  const markerIcons={pin:'📍',mug:'🍺',bottle:'🍾',cheers:'🍻',pretzel:'🥨',sausage:'🌭',fries:'🍟',cheese:'🧀',nuts:'🥜',party:'🎉'};
  const messages=['ここにいます','乾杯はここで','ここで合流！','次の一杯はここ','一杯いかが？','みんなで乾杯','ビール日和！','おつまみもぜひ','そろそろ乾杯','楽しく飲みましょう'];
  let markerShape='pin',message=messages[0];
  function randomOther(values,current){let next;do{next=values[Math.floor(Math.random()*values.length)]}while(next===current);return next}
  function applyMarker(){
    layer.style.setProperty('--marker-size',markerSize+'px');
    layer.style.setProperty('--label-gap','10px');
    pin.className='pin is-'+markerShape;
    pin.querySelectorAll('svg').forEach(icon=>{
      const active=icon.classList.contains(markerShape+'-symbol');
      icon.toggleAttribute('hidden',!active);
      icon.style.display=active?'block':'none';
    });
    const isEmoji=!['pin','mug','bottle'].includes(markerShape);
    emojiPin.toggleAttribute('hidden',!isEmoji);
    emojiPin.style.display=isEmoji?'block':'none';
    emojiPin.textContent=isEmoji?markerIcons[markerShape]:'';
    bubble.textContent=message;
    markerButton.textContent=markerIcons[markerShape];
    markerButton.title=`マーカーとメッセージをランダムに変更（現在: ${markerNames[markerShape]}・${message}）`;
    markerButton.setAttribute('aria-label',markerButton.title);
  }
  markerButton.addEventListener('click',()=>{
    markerShape=randomOther(markerShapes,markerShape);
    message=randomOther(messages,message);
    applyMarker();
    status.textContent=`${markerNames[markerShape]}・${message}`;
  });
  applyMarker();
  function applyView(){
    const maxX=map.clientWidth*(view.scale-1)/2,maxY=map.clientHeight*(view.scale-1)/2;
    view.tx=Math.max(-maxX,Math.min(maxX,view.tx));view.ty=Math.max(-maxY,Math.min(maxY,view.ty));
    layer.style.transform=`translate(${view.tx}px,${view.ty}px) scale(${view.scale})`;
    layer.style.setProperty('--inverse-zoom',1/view.scale);
    document.querySelector('#zoomLevel').textContent=Math.round(view.scale*100)+'%';
  }
  function zoomTo(next){view.scale=Math.max(1,Math.min(4,next));if(view.scale===1)view.tx=view.ty=0;applyView()}
  map.addEventListener('wheel',e=>{e.preventDefault();zoomTo(view.scale+(e.deltaY<0 ? .25 : -.25))},{passive:false});
  map.addEventListener('pointerdown',e=>{
    e.preventDefault();map.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY});
    if(pointers.size===1)gesture={tx:view.tx,ty:view.ty,moved:false};
    if(pointers.size===2){const a=[...pointers.values()];gesture={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),scale:view.scale,tx:view.tx,ty:view.ty,moved:true}}
  });
  map.addEventListener('pointermove',e=>{
    const p=pointers.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;
    if(pointers.size===2){const a=[...pointers.values()];view.scale=Math.max(1,Math.min(4,gesture.scale*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/gesture.distance));applyView();return}
    if(pointers.size===1&&view.scale>1){const dx=p.x-p.sx,dy=p.y-p.sy;if(Math.hypot(dx,dy)>5)gesture.moved=true;view.tx=gesture.tx+dx;view.ty=gesture.ty+dy;applyView()}
  });
  function endPointer(e){
    const p=pointers.get(e.pointerId);if(!p)return;const wasTap=pointers.size===1&&!gesture?.moved&&Math.hypot(p.x-p.sx,p.y-p.sy)<8;pointers.delete(e.pointerId);
    if(wasTap){const r=layer.getBoundingClientRect();setPos((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);status.textContent='位置を指定しました';navigator.vibrate?.(25)}
    if(pointers.size===1){const left=[...pointers.values()][0];left.sx=left.x;left.sy=left.y;gesture={tx:view.tx,ty:view.ty,moved:true}}
  }
  map.addEventListener('pointerup',endPointer);map.addEventListener('pointercancel',endPointer);
  document.querySelector('#reset').onclick=()=>{setPos(.5,.5);view={scale:1,tx:0,ty:0};applyView();status.textContent='地図とマーカーをリセットしました'};
  const mapImage=layer.querySelector('img'),shotButton=document.querySelector('#shot');
  const shotDialog=document.querySelector('#shotDialog'),shotPreview=document.querySelector('#shotPreview');
  const downloadShot=document.querySelector('#downloadShot'),shareShot=document.querySelector('#shareShot');
  let shotObjectUrl=null,shotFile=null;
  function drawMarker(ctx,x,y,size){
    ctx.save();ctx.shadowColor='#0005';ctx.shadowBlur=size*.07;ctx.shadowOffsetY=size*.05;
    if(markerShape==='mug'){
      ctx.translate(x-size/2,y-size*60/48);ctx.scale(size/48,size/48);
      ctx.lineWidth=5;ctx.strokeStyle='#a65a13';ctx.beginPath();ctx.moveTo(33,22);ctx.lineTo(38,22);ctx.arc(38,29,7,-Math.PI/2,Math.PI/2);ctx.lineTo(33,36);ctx.stroke();
      const body=new Path2D('M10 18h25l-2 31H13z');ctx.fillStyle='#efa927';ctx.strokeStyle='#7c4518';ctx.lineWidth=2.5;ctx.fill(body);ctx.stroke(body);
      ctx.shadowColor='transparent';ctx.strokeStyle='#ffe08a';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(16,26);ctx.lineTo(16,43);ctx.moveTo(23,26);ctx.lineTo(23,43);ctx.stroke();
      const foam=new Path2D('M10 19c-2-5 2-9 6-7 3-5 9-4 11 0 5-2 10 2 8 7 0 4-3 5-6 4-2 4-7 4-9 0-5 3-10 1-10-4Z');ctx.fillStyle='#fff9e8';ctx.strokeStyle='#d7b766';ctx.lineWidth=2;ctx.fill(foam);ctx.stroke(foam);
    }else if(markerShape==='bottle'){
      ctx.translate(x-size/2,y-size*60/48);ctx.scale(size/48,size/48);
      const bottle=new Path2D('M20 9h8v12c0 3 5 6 5 11v20c0 3-2 5-5 5H20c-3 0-5-2-5-5V32c0-5 5-8 5-11Z');ctx.fillStyle='#27845b';ctx.strokeStyle='white';ctx.lineWidth=2.5;ctx.fill(bottle);ctx.stroke(bottle);
      ctx.shadowColor='transparent';ctx.fillStyle='#e8a92c';ctx.fillRect(19,9,10,5);ctx.fillStyle='#f5c54d';ctx.fillRect(15,34,18,15);ctx.fillStyle='#fff6d8';ctx.fillRect(20,37,8,9);
      ctx.strokeStyle='#c7e8af';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(22,18);ctx.lineTo(26,18);ctx.stroke();
    }else if(markerShape==='pin'){
      ctx.translate(x-size/2,y-size*60/48);ctx.scale(size/48,size/48);
      const shape=new Path2D('M24 58C20 50 3 34 3 23a21 21 0 0 1 42 0c0 11-17 27-21 35Z');
      ctx.fillStyle='#c65b47';ctx.strokeStyle='white';ctx.lineWidth=3;ctx.fill(shape);ctx.stroke(shape);
      ctx.shadowColor='transparent';ctx.beginPath();ctx.arc(24,23,7,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();
    }else{
      ctx.font=`${size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(markerIcons[markerShape],x,y);
    }
    ctx.restore();
  }
  async function makeScreenshot(){
    await mapImage.decode();
    const mapRect=map.getBoundingClientRect(),imageRect=mapImage.getBoundingClientRect();
    if(!mapRect.width||!mapRect.height)throw new Error('地図を表示できません');
    const width=1200,scale=width/mapRect.width,top=112,mapHeight=Math.round(mapRect.height*scale);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=top+mapHeight;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('画像を作成できません');
    ctx.fillStyle='#f5f4ef';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#202722';ctx.font='900 52px -apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif';ctx.fillText('🍺 いまここ',40,65,330);
    ctx.fillStyle='#657067';ctx.font='700 25px -apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif';ctx.fillText('待ち合わせマップ',40,98,400);
    ctx.fillStyle='#202722';
    ctx.font='700 48px -apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif';ctx.textAlign='right';ctx.fillText(document.querySelector('#clock').textContent,width-40,77,220);ctx.textAlign='left';
    ctx.fillStyle='#bcc2b9';ctx.fillRect(0,top-1,width,1);
    ctx.save();ctx.beginPath();ctx.rect(0,top,width,mapHeight);ctx.clip();
    ctx.fillStyle='white';ctx.fillRect(0,top,width,mapHeight);
    ctx.drawImage(mapImage,(imageRect.left-mapRect.left)*scale,top+(imageRect.top-mapRect.top)*scale,imageRect.width*scale,imageRect.height*scale);
    const x=(imageRect.left+imageRect.width*pos.x-mapRect.left)*scale;
    const y=top+(imageRect.top+imageRect.height*pos.y-mapRect.top)*scale;
    drawMarker(ctx,x,y,markerSize*scale);
    const b=bubble.getBoundingClientRect(),bx=(b.left-mapRect.left)*scale,by=top+(b.top-mapRect.top)*scale,bw=b.width*scale,bh=b.height*scale;
    ctx.fillStyle='#202722';ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle='white';ctx.font=`900 ${13*scale}px -apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(bubble.textContent,bx+bw/2,by+bh/2,bw-16*scale);
    ctx.restore();
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('画像を保存できません')),'image/png'));
  }
  shotButton.onclick=async()=>{
    shotButton.disabled=true;
    try{
      const blob=await makeScreenshot(),now=new Date();
      if(shotObjectUrl)URL.revokeObjectURL(shotObjectUrl);
      shotObjectUrl=URL.createObjectURL(blob);
      const stamp=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('')+'-'+[now.getHours(),now.getMinutes()].map(n=>String(n).padStart(2,'0')).join('');
      shotFile=new File([blob],`keyaki-imakoko-${stamp}.png`,{type:'image/png'});
      shotPreview.src=shotObjectUrl;downloadShot.href=shotObjectUrl;downloadShot.download=shotFile.name;
      shareShot.hidden=!navigator.canShare?.({files:[shotFile]});
      shotDialog.showModal();
    }catch(err){console.error(err);say('画像を作れませんでした。もう一度お試しください')}
    finally{shotButton.disabled=false}
  };
  shareShot.onclick=async()=>{if(!shotFile)return;try{await navigator.share({files:[shotFile],title:'けやきビール祭り｜いまここ'})}catch(err){if(err.name!=='AbortError')say('共有できませんでした')}};
  document.querySelector('#closeShot').onclick=()=>shotDialog.close();
  shotDialog.onclick=e=>{if(e.target===shotDialog)shotDialog.close()};
  shotDialog.addEventListener('close',()=>{shotPreview.removeAttribute('src');downloadShot.removeAttribute('href');if(shotObjectUrl)URL.revokeObjectURL(shotObjectUrl);shotObjectUrl=null;shotFile=null});
  window.addEventListener('resize',applyView);
  applyView();
})();

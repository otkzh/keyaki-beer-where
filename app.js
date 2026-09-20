(()=>{
  const map=document.querySelector('#map'),layer=document.querySelector('#mapLayer'),pin=document.querySelector('#pin'),bubble=document.querySelector('#bubble');
  const status=document.querySelector('#status'),toast=document.querySelector('#toast');
  let pos=JSON.parse(localStorage.getItem('keyaki-pin')||'null')||{x:.5,y:.5};
  function setPos(x,y,save=true){pos={x:Math.max(.025,Math.min(.975,x)),y:Math.max(.12,Math.min(.94,y))};pin.style.left=bubble.style.left=(pos.x*100)+'%';pin.style.top=bubble.style.top=(pos.y*100)+'%';if(save)localStorage.setItem('keyaki-pin',JSON.stringify(pos));}
  function say(t){toast.textContent=t;toast.classList.add('on');clearTimeout(say.t);say.t=setTimeout(()=>toast.classList.remove('on'),1800)}
  function clock(){const d=new Date;document.querySelector('#clock').textContent=d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})} clock();setInterval(clock,30000);setPos(pos.x,pos.y,false);
  let view={scale:1,tx:0,ty:0},pointers=new Map(),gesture=null;
  const markerSize=42;
  let markerShape='drop';
  function applyMarker(){
    layer.style.setProperty('--marker-size',markerSize+'px');
    layer.style.setProperty('--label-gap',(markerShape==='cross'?markerSize/2+8:10)+'px');
    pin.className='pin is-'+markerShape;
    pin.querySelectorAll('svg').forEach(icon=>icon.toggleAttribute('hidden',!icon.classList.contains(markerShape+'-symbol')));
    pin.setAttribute('aria-label',markerShape==='drop'?'ドロップのマーカー。タップで十字に切り替え':'十字のマーカー。タップでドロップに切り替え');
  }
  pin.addEventListener('pointerdown',e=>e.stopPropagation());
  pin.addEventListener('pointerup',e=>e.stopPropagation());
  pin.addEventListener('pointercancel',e=>e.stopPropagation());
  pin.addEventListener('click',e=>{
    e.stopPropagation();markerShape=markerShape==='drop'?'cross':'drop';applyMarker();
    status.textContent=markerShape==='drop'?'ドロップに切り替えました':'十字に切り替えました';
  });
  applyMarker();
  const priceModeButton=document.querySelector('#priceMode'),regionSelector=document.querySelector('#regionSelector'),regionSelect=document.querySelector('#regionSelect');
  const shopPanel=document.querySelector('#shopPanel'),shopPanelBody=document.querySelector('#shopPanelBody'),shopFocus=document.querySelector('#shopFocus'),shopHotspots=document.querySelector('#shopHotspots');
  let shopMode=false,shops=[],activeRegion='',selectedShop=null;
  const catalogPromise=fetch('data/beers.json?v=1').then(response=>{if(!response.ok)throw new Error('店舗データを読み込めません');return response.json()}).then(data=>data.shops);
  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}
  function filteredShops(){return activeRegion?shops.filter(shop=>shop.region===activeRegion):shops}
  function regionStatus(){return activeRegion?`${activeRegion}の${filteredShops().length}店舗を強調表示。番号をタップ`:'店舗番号をタップして銘柄と価格を表示'}
  function closeShop(){shopPanel.hidden=true;shopFocus.hidden=true;selectedShop=null}
  function applyRegion(){
    activeRegion=regionSelect.value;
    for(const button of shopHotspots.children){
      const match=!activeRegion||button.dataset.region===activeRegion;
      button.hidden=!match;
      button.classList.toggle('is-match',!!activeRegion&&match);
    }
    if(selectedShop&&activeRegion&&selectedShop.region!==activeRegion)closeShop();
    status.textContent=regionStatus();
  }
  function showShop(shop){
    document.querySelector('#shopNumber').textContent=`出店番号 ${shop.booth} ・ ${shop.region}`;
    document.querySelector('#shopPanelTitle').textContent=shop.name;
    shopPanelBody.replaceChildren();
    if(shop.sets.length){
      shopPanelBody.append(element('h3','',`飲み比べセット ${shop.sets.length}件`));
      for(const set of shop.sets){
        const item=element('div','shop-item');
        item.append(element('div','shop-item-name',set.name));
        item.append(element('div','shop-price-list',set.price_text||'価格未掲載'));
        if(set.description)item.append(element('p','shop-item-description',set.description));
        shopPanelBody.append(item);
      }
    }
    shopPanelBody.append(element('h3','',`ビール ${shop.beers.length}件`));
    for(const beer of shop.beers){
      const item=element('div','shop-item'),name=element('div','shop-item-name');
      const link=element('a','',beer.name);link.href=beer.url;link.target='_blank';link.rel='noopener';name.append(link);
      for(const tag of beer.tags)name.append(element('span','shop-tag',tag));
      item.append(name);
      const prices=element('div','shop-price-list');
      if(!beer.prices.length)prices.append(element('span','','価格未掲載'));
      for(const price of beer.prices){
        const entry=element('span');
        const label=[price.size,price.volume_text].filter(Boolean).join(' / ');
        if(label)entry.append(document.createTextNode(label+' '));
        entry.append(element('strong','',price.price_text||'価格未掲載'));
        prices.append(entry);
      }
      item.append(prices);shopPanelBody.append(item);
    }
    const source=element('p','shop-source','価格は公式サイト掲載時点の情報です。 ');
    const sourceLink=element('a','','公式の店舗ページを確認');sourceLink.href=shop.url;sourceLink.target='_blank';sourceLink.rel='noopener';source.append(sourceLink);shopPanelBody.append(source);
    shopPanelBody.scrollTop=0;shopPanel.hidden=false;selectedShop=shop;
    shopFocus.style.left=shop.map_position.x*100+'%';shopFocus.style.top=shop.map_position.y*100+'%';shopFocus.hidden=false;
    status.textContent=`出店番号 ${shop.booth}・${shop.name}`;
  }
  function findShop(clientX,clientY){
    const rect=layer.querySelector('img').getBoundingClientRect();
    const x=(clientX-rect.left)/rect.width,y=(clientY-rect.top)/rect.height;
    let best=null,bestScore=Infinity;
    for(const shop of filteredShops()){
      const dx=(x-shop.map_position.x)/.06,dy=(y-shop.map_position.y)/.022;
      const score=dx*dx+dy*dy;
      if(score<bestScore){best=shop;bestScore=score}
    }
    return bestScore<=1.3?best:null;
  }
  priceModeButton.onclick=async()=>{
    if(shopMode){shopMode=false;document.querySelector('.app').classList.remove('price-mode');priceModeButton.setAttribute('aria-pressed','false');regionSelector.hidden=true;shopHotspots.hidden=true;regionSelect.value='';activeRegion='';closeShop();map.setAttribute('aria-label','会場図。タップすると待ち合わせ位置のマーカーを移動できます');status.textContent='地図をタップして位置を指定';return}
    priceModeButton.disabled=true;status.textContent='店舗データを読み込み中';
    try{
      shops=await catalogPromise;
      if(regionSelect.options.length===1){
        const order=['北海道','東北','関東','北陸・甲信越','東海','近畿','中国・四国','九州・沖縄','海外'];
        const regions=[...new Set(shops.map(shop=>shop.region))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
        for(const region of regions){const count=shops.filter(shop=>shop.region===region).length;const option=element('option','',`${region}（${count}店舗）`);option.value=region;regionSelect.append(option)}
      }
      if(!shopHotspots.childElementCount){for(const shop of shops){const button=element('button');button.type='button';button.style.left=shop.map_position.x*100+'%';button.style.top=shop.map_position.y*100+'%';button.dataset.region=shop.region;button.setAttribute('aria-label',`出店番号 ${shop.booth} ${shop.name}`);button.onclick=()=>showShop(shop);shopHotspots.append(button)}}
      shopMode=true;document.querySelector('.app').classList.add('price-mode');priceModeButton.setAttribute('aria-pressed','true');regionSelector.hidden=false;
      shopHotspots.hidden=false;
      applyRegion();map.setAttribute('aria-label','会場図。店舗をタップするとビールの銘柄と価格を表示します');
    }catch(error){console.error(error);status.textContent='店舗データを読み込めませんでした';say('店舗データを読み込めませんでした')}
    finally{priceModeButton.disabled=false}
  };
  regionSelect.onchange=applyRegion;
  document.querySelector('#closeShop').onclick=()=>{closeShop();status.textContent=regionStatus()};
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
    if(wasTap){
      if(shopMode){const shop=findShop(e.clientX,e.clientY);if(shop){showShop(shop);navigator.vibrate?.(25)}else say('店舗番号の近くをタップしてください')}
      else{const r=layer.getBoundingClientRect();setPos((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);status.textContent='位置を指定しました';navigator.vibrate?.(25)}
    }
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
    if(markerShape==='cross'){
      ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y-size*.42);ctx.lineTo(x,y+size*.42);ctx.moveTo(x-size*.42,y);ctx.lineTo(x+size*.42,y);
      ctx.strokeStyle='white';ctx.lineWidth=size*.19;ctx.stroke();ctx.strokeStyle='#f0527b';ctx.lineWidth=size*.105;ctx.stroke();
    }else{
      ctx.translate(x-size/2,y-size*60/48);ctx.scale(size/48,size/48);
      const shape=new Path2D('M24 58C20 50 3 34 3 23a21 21 0 0 1 42 0c0 11-17 27-21 35Z');
      ctx.fillStyle='#c65b47';ctx.strokeStyle='white';ctx.lineWidth=3;ctx.fill(shape);ctx.stroke(shape);
      ctx.shadowColor='transparent';ctx.beginPath();ctx.arc(24,23,7,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();
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

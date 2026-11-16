/* ===== 8b. Museum of Islamic Heritage: exhibits, passport, labels ===== */
/* ===== EXHIBIT_PHOTOS: the ONLY place the game talks to the network. Keyed by exhibit number (1..26).
   Each photo is hot-linked (public domain / CC0) and loaded only when that exhibit's card is open.
   For production, copy the 15 images to your own CDN and change the urls below. ===== */
const MET='https://images.metmuseum.org/CRDImages/is/web-large/',METP='https://www.metmuseum.org/art/collection/search/',MET_CR='. The Metropolitan Museum of Art. Public domain (CC0).';
const EXHIBIT_PHOTOS={
1:{url:MET+'DP170386.jpg',page:METP+'444408',credit:'Astrolabe of \u02BFUmar ibn Yusuf al-Muzaffari, Yemen, 1291'+MET_CR},
5:{url:MET+'DP369551.jpg',page:METP+'451302',credit:"Design for the Water Clock of the Peacocks, from al-Jazari's book, 1315"+MET_CR},
7:{url:MET+'35.128.3%28side2%29.jpg',page:METP+'449030',credit:'Inkwell with lid, Iran, 13th century'+MET_CR},
9:{url:MET+'DP231243.jpg',page:METP+'446151',credit:'Carved wooden manuscript stand, Iran, 1360'+MET_CR},
10:{url:'https://iiif.wellcomecollection.org/image/L0014122/full/640,/0/default.jpg',page:'https://wellcomecollection.org/works/zhzf456e',credit:"Page from a 1632 copy of Ibn Sina's Canon of Medicine. Wellcome Collection. Public domain."},
11:{url:'https://iiif.wellcomecollection.org/image/M0007157/full/640,/0/default.jpg',page:'https://wellcomecollection.org/works/ckfkzv7u',credit:"Page from a 15th-century Latin copy of al-Zahrawi's surgery book. Wellcome Collection. Public domain."},
13:{url:MET+'DP170362.jpg',page:METP+'444897',credit:'Iznik tile, Turkey, about 1578'+MET_CR},
14:{url:MET+'DP217237.jpg',page:METP+'451751',credit:'Lustre bowl with two peacocks, Iraq, 10th century'+MET_CR},
16:{url:MET+'91.1.1537.jpg',page:METP+'444716',credit:'Enamelled glass mosque lamp, Syria, about 1350'+MET_CR},
17:{url:MET+'DP-17256-002.jpg',page:METP+'444586',credit:'Brass ewer inlaid with silver, Iraq, 1226'+MET_CR},
19:{url:MET+'DP239701.jpg',page:METP+'453447',credit:'Gold dinar, Syria, 698\u201399'+MET_CR},
22:{url:'https://iiif.micr.io/hvfse/full/640,/0/default.jpg',page:'https://www.rijksmuseum.nl/en/collection/object/Interieur-van-de-Mezquita-van-Cordoba--b1bdf27c969d178c2c3d425626526fe8',credit:'Juan Laurent, interior of the Mosque of C\u00F3rdoba, 1868\u201383. Rijksmuseum. Public domain.'},
24:{url:'https://iiif.micr.io/CyUmv/full/640,/0/default.jpg',page:'https://www.rijksmuseum.nl/en/collection/object/RP-F-00-19816--04ffc1e4b0ba4608a36a7e4580badb18',credit:'Court of the Lions, Alhambra, postcard about 1918\u201330. Rijksmuseum. Public domain.'},
25:{url:MET+'DP251461.jpg',page:METP+'449462',credit:'Muqarnas element, Iran, 10th century'+MET_CR},
26:{url:MET+'DP222480.jpg',page:METP+'443173',credit:'Silver coffee pot, Ottoman Turkey, 1809\u201360'+MET_CR}};
/* small in-memory cache of loaded photos (max 6, oldest dropped); emptied when the player leaves the museum area */
const exPhCache=new Map();let exTok=0;
function exPhotoLoad(num,cb){
 const ph=EXHIBIT_PHOTOS[num];if(!ph)return;
 const c=exPhCache.get(num);if(c){exPhCache.delete(num);exPhCache.set(num,c);cb(c,ph);return}
 if(navigator.onLine===false)return;
 let done=false;const im=new Image(),tm=setTimeout(()=>{done=true;im.onload=im.onerror=null},6000);
 im.onload=()=>{if(done)return;done=true;clearTimeout(tm);im.onload=im.onerror=null;
  if(!im.naturalWidth)return;
  exPhCache.set(num,im);if(exPhCache.size>6)exPhCache.delete(exPhCache.keys().next().value);cb(im,ph)};
 im.onerror=()=>{done=true;clearTimeout(tm);im.onload=im.onerror=null};
 try{im.referrerPolicy='no-referrer'}catch(e){}
 im.alt='';im.src=ph.url;
}
const PAL=[[.93,.72,.2],[.74,.5,.2],[.2,.4,.72],[.15,.62,.62],[.76,.2,.2],[.95,.9,.78],[.25,.18,.14],[.2,.6,.35],[.12,.12,.16],[.66,.68,.72],[.58,.4,.24],[.96,.96,.98],[.66,.46,.3],[.55,.78,.95]];
const palCss=c=>'rgb('+(PAL[c][0]*255|0)+','+(PAL[c][1]*255|0)+','+(PAL[c][2]*255|0)+')';
const MFLOORS=[['Ground floor','Stars and Numbers'],['Floor 1','The Art of the Book and Healing'],['Floor 2','Fire, Clay and Thread'],['Floor 3','Journeys and Buildings']];
/* [name, where and when, text, skill, question, right answer, wrong 1, wrong 2, model parts [shape(0 box,1 round), x, y, w, h, depth, colour], back to front] */
const EXD=[
['Astrolabe','Aleppo, 10th century','An astrolabe is a metal disc for measuring the sky. People used it to tell the time, find directions and find the positions of stars. Maryam al-Ijliyya made astrolabes in Aleppo in the 10th century.','science','What was an astrolabe used for?','Measuring the sky to tell the time','Grinding grain','Writing letters',
 [[1,8,8,14,14,2,1],[1,8,8,11,11,3,0],[0,8,8,1,12,4,6],[0,8,8,12,1,4,6],[1,8,8,4,4,5,9],[1,8,14.6,3,3,2,1]]],
['Celestial globe','The 10th century','A celestial globe is a ball that shows the stars. Abd al-Rahman al-Sufi wrote the Book of Fixed Stars in the 10th century.','science','What does a celestial globe show?','The stars','The oceans','The mountains',
 [[0,8,1.5,9,3,9,6],[0,8,4,3,3,3,6],[1,8,9.5,15,15,2,0],[1,8,9.5,11,11,5,2],[0,6,11.5,1.4,1.4,6,0],[0,10.5,8.5,1.4,1.4,6,0],[0,8,9.5,1.4,1.4,6,0],[0,9.5,12,1.4,1.4,6,0]]],
['Algebra book','Baghdad, 9th century','Al-Khwarizmi wrote a famous book on algebra in Baghdad in the 9th century. The word "algorithm" comes from his name.','science','Which word comes from the name of Al-Khwarizmi?','Algorithm','Calendar','Compass',
 [[0,8,3,15,5,5,6],[0,4.5,7,6.5,8,6,5],[0,11.5,7,6.5,8,6,5],[0,4.5,8.5,4,.8,7,2],[0,4.5,6.5,4,.8,7,2],[0,11.5,8.5,4,.8,7,4],[0,11.5,6.5,2.5,.8,7,4],[0,8,7,.8,9,7,6]]],
['Camera obscura','About 1,000 years ago','Ibn al-Haytham studied light about 1,000 years ago. He showed that we see because light enters our eyes. A camera obscura is a dark room.','science','Why can we see things, said Ibn al-Haytham?','Light enters our eyes','Our eyes send out beams','Things make their own light',
 [[0,8,6.5,14,12,10,6],[0,8,6.5,12,10,11,8],[0,3.5,6.5,1.4,1.4,12,11],[0,6,6.5,4,.8,12,0],[0,10.5,6.5,4.5,5.5,12,13],[0,10.5,6.5,2,3,13,4]]],
['Water clock','Book finished in 1206','Al-Jazari described clever clocks and machines in a book finished in 1206. This model shows a water clock.','science','Who described clever clocks and machines in a book finished in 1206?','Al-Jazari','Ibn Sina','Al-Idrisi',
 [[0,8,1.5,12,3,9,10],[0,8,6,7,7,7,2],[0,8,11.5,5,4,6,3],[0,8,6,3,3,8,11],[1,8,14.5,2.5,2.5,5,3],[0,8,3.7,1,2,5,13]]],
['Windmill model','Persia','Early windmills with upright sails were used in Persia to grind grain.','science','What were early windmills in Persia used for?','Grinding grain','Telling the time','Making paper',
 [[0,8,4,9,8,9,5],[0,8,9.3,11,2,11,4],[0,8,12,5,3,7,5],[0,8,10,15,1.2,12,11],[0,8,10,1.2,12,12,11],[1,8,10,2.5,2.5,13,6]]],
['Reed pen and inkwell','The art of writing','Writers cut a reed into a pen called a qalam. Beautiful handwriting is called calligraphy.','knowledge','What is a pen cut from a reed called?','A qalam','A lantern','An astrolabe',
 [[0,10.5,3.5,6,7,6,8],[0,10.5,7.5,3,1.5,5,9],[0,5,8,1.2,13,3,10],[0,5,1.8,1.2,2.5,3,8],[0,3,9,2,2,4,0]]],
['Paper making','Samarkand and Baghdad, 8th century','Paper-making spread from China. Paper mills worked in Samarkand and Baghdad in the 8th century. Paper made books cheaper.','knowledge','Where did paper-making spread from?','China','Spain','Yemen',
 [[0,8,3,13,6,10,10],[0,8,6,11,1,8,13],[0,8,7.5,11,2.5,9,11],[0,12,12,3,5,3,11],[0,4.5,12.5,3,4,3,5]]],
['Bookstand and book','Baghdad','Libraries such as the House of Wisdom in Baghdad collected and translated books from many lands.','knowledge','What did the House of Wisdom in Baghdad collect and translate?','Books from many lands','Coins','Boats',
 [[0,8,1.2,10,2.4,10,10],[0,8,5,2,6,8,10],[0,8,9,12,8,3,10],[0,8,9.5,10,6.5,5,4],[0,8,9.5,.8,6.5,6,0],[0,5.5,11,3,.8,6,0],[0,10.5,8,3,.8,6,0]]],
['Canon of Medicine','Finished in 1025','Ibn Sina finished this medical encyclopedia in 1025. Doctors used it for hundreds of years.','science','Who finished the Canon of Medicine in 1025?','Ibn Sina','Al-Khwarizmi','Al-Jazari',
 [[0,8,8,12,13,5,2],[0,8,8,10,11,6,0],[0,8,8,8,9,7,2],[0,8,8,3,3,8,0],[0,2.8,8,1.4,13,6,6]]],
["Surgeon's tools",'Cordoba, about 1,000 years ago','Al-Zahrawi of Cordoba drew around 200 medical instruments in his book. He lived about 1,000 years ago.','science','About how many medical instruments did Al-Zahrawi draw?','Around 200','Around 20','Around 2,000',
 [[0,8,2.5,14,3,10,6],[0,4,9,1.2,9,5,9],[0,4,13.2,3,1.5,5,9],[0,8,9,1.2,11,5,9],[0,12,9,1.2,8,5,9],[0,12,13.8,2.5,.8,5,9],[0,4,4.5,2,3,6,10],[0,8,4,2,2,6,10]]],
['Hospital model (bimaristan)','Cairo, 1284','Hospitals such as the Mansuri Hospital in Cairo (1284) treated patients for free. A hospital was called a bimaristan.','science','How did the Mansuri Hospital in Cairo treat patients?','For free','Only on Fridays','With a big fee',
 [[0,8,3,14,6,10,5],[0,8,8,8,5,8,5],[1,8,11.5,6,5,7,3],[0,8,3,3,4.5,11,8],[0,3,5,2,2,11,13],[0,13,5,2,2,11,13],[0,8,14.5,.9,2,8,7]]],
['Iznik tile','Iznik, Turkey, 16th century','Colourful tiles were made in Iznik in Ottoman Turkey in the 16th century. They show blue, turquoise and red flowers.','knowledge','Where were these colourful tiles made?','Iznik','Cordoba','Samarkand',
 [[0,8,8,14,14,3,5],[0,8,8,12,12,4,2],[0,8,8,10,10,5,5],[1,8,8,4,4,6,4],[1,8,11.2,3.2,3.2,6,3],[1,8,4.8,3.2,3.2,6,3],[1,4.8,8,3.2,3.2,6,3],[1,11.2,8,3.2,3.2,6,3],[0,4,4,2,1,6,7],[0,12,12,2,1,6,7]]],
['Lustre bowl','Iraq, 9th century','Potters in Iraq in the 9th century learned to give pottery a metallic shine.','knowledge','What did potters in Iraq learn to give pottery?','A metallic shine','Wings','A sweet smell',
 [[0,8,1.5,5,3,5,1],[0,8,4.5,9,3,9,0],[0,8,7.5,13,3.5,13,1],[0,8,9.5,14,1,14,0],[0,5,6,1.4,1.4,10,11],[0,8,5.5,1.4,1.4,10,11],[0,11,6,1.4,1.4,10,11]]],
['Zellige panel','Morocco','In Morocco, craftsmen cut small coloured tiles by hand and fit them into star patterns.','knowledge','How do craftsmen make a zellige panel?','Cut small tiles and fit them into star patterns','Paint one big picture','Weave coloured threads',
 [[0,8,8,14,14,3,5],[0,8,8,5,13,4,2],[0,8,8,13,5,4,2],[0,8,8,9,9,5,3],[0,8,8,5,5,6,4],[0,8,8,2,2,7,0],[0,3,3,3,3,4,7],[0,13,3,3,3,4,7],[0,3,13,3,3,4,7],[0,13,13,3,3,4,7]]],
['Glass mosque lamp','Egypt and Syria, 14th century','Glass lamps decorated with enamel were made in Egypt and Syria in the 14th century.','knowledge','In which century were these enamel glass lamps made in Egypt and Syria?','The 14th century','The 2nd century','The 20th century',
 [[0,8,15,1,2,2,6],[0,8,13,3,3,3,0],[0,8,10.5,6,3,6,13],[1,8,7,11,9,9,2],[0,8,6.5,10,1,10,0],[0,8,9,10,1,10,0],[0,8,2.5,5,3,5,0],[0,8,3.5,2,2,6,13]]],
['Inlaid brass ewer','Mosul, 13th century','Metalworkers in Mosul in the 13th century decorated brass jugs with silver.','knowledge','What did metalworkers in Mosul use to decorate brass jugs?','Silver','Feathers','Wool',
 [[0,8,1.5,5,3,5,1],[0,8,5.5,8,5,8,1],[0,8,6,8.6,1,8.6,11],[0,8,10.5,5,4,5,1],[0,8,13.5,7,2,7,1],[0,3.5,12.5,3,1.8,4,1],[0,12.5,8.5,1.6,8,3,1],[0,8,4,9,.6,9,11]]],
['Knotted carpet','Persia, 1539-40','The Ardabil Carpet was made in Persia in 1539-40. It is one of the oldest dated carpets in the world.','knowledge','The Ardabil Carpet is one of the oldest what in the world?','Dated carpets','Clocks','Maps',
 [[0,8,2,14,1,3,5],[0,8,14,14,1,3,5],[0,8,8,14,12,2,4],[0,8,8,11,9,3,2],[0,8,8,8,6,4,5],[0,8,8,4,4,5,4],[0,8,8,2,2,6,0],[0,4,8,1.5,6,4,0],[0,12,8,1.5,6,4,0]]],
['Gold dinar','The 690s','In the 690s, Caliph Abd al-Malik made coins decorated with writing only.','knowledge','In which years did Caliph Abd al-Malik make these coins?','The 690s','The 1290s','The 1790s',
 [[1,8,8,14,14,2,0],[1,8,8,11,11,3,1],[1,8,8,8,8,4,0],[0,8,8,5,1,5,1],[0,8,8,1,5,5,1],[0,8,8,2,2,6,0]]],
["Al-Idrisi's map",'Sicily, 1154','In 1154 Al-Idrisi made a great map of the world in Sicily. On his map, south was at the top.','knowledge','On the map of Al-Idrisi, which direction was at the top?','South','North','East',
 [[0,8,8,15,11,2,5],[0,8,8,14,10,3,13],[0,5,9,5,4,4,7],[0,10.5,6.5,5,5,4,7],[0,8,4,3,2,4,5],[0,13,10,2,3,4,5],[0,8,12.6,1,1.6,5,4]]],
["Ibn Battuta's journey",'From 1325','From 1325 Ibn Battuta travelled for about 30 years. He went around 117,000 km.','knowledge','About how far did Ibn Battuta travel?','Around 117,000 km','Around 1,170 km','Around 11 km',
 [[0,8,8,15,11,2,5],[0,8,8,14,10,3,3],[0,4.5,9,5,5,4,5],[0,11.5,7,5,6,4,5],[0,4,10,1,1,5,4],[0,6,8.5,1,1,5,4],[0,8,7,1,1,5,4],[0,10,8,1,1,5,4],[0,12,6.5,1,1,5,4]]],
['Model: Great Mosque of Cordoba','Cordoba, Spain','The Great Mosque of Cordoba is famous for its forest of red-and-white double arches.','knowledge','What is the Great Mosque of Cordoba famous for?','Red-and-white double arches','A glass floor','A tower of ice',
 [[0,8,3,15,6,10,5],[0,2.5,6,2,5,11,4],[0,5,6,2,5,11,11],[0,7.5,6,2,5,11,4],[0,10,6,2,5,11,11],[0,12.5,6,2,5,11,4],[0,8,9.5,15,2,11,4],[0,4,9.5,2,2,11,11],[0,8,9.5,2,2,11,11],[0,12,9.5,2,2,11,11],[0,8,12.5,15,1.5,10,5]]],
['Model: Great Mosque of Djenne','Mali','The Great Mosque of Djenne is in Mali. It is the largest mud-brick building in the world.','knowledge','What is the Great Mosque of Djenne made of?','Mud brick','Gold','Glass',
 [[0,8,5,12,10,9,12],[0,3.5,9,3,13,8,12],[0,12.5,9,3,13,8,12],[0,8,12,4,12,8,12],[0,3.5,15.5,.8,2.5,3,6],[0,12.5,15.5,.8,2.5,3,6],[0,8,16,.8,2,3,6]]],
['Model: Alhambra','Granada, Spain','The Alhambra is a palace in Granada, Spain. It has courtyards, fountains and carved patterns.','knowledge','In which country is the Alhambra?','Spain','Mali','Turkey',
 [[0,8,2.5,15,5,10,5],[0,8,3.5,6,2,11,2],[0,3,8,4,9,9,12],[0,13,8,4,9,9,12],[0,3,13.5,5,2,10,4],[0,13,13.5,5,2,10,4],[0,6,6,1,4,11,11],[0,10,6,1,4,11,11],[0,8,8.5,5,1,11,12]]],
['Muqarnas and mashrabiya','Ceilings and windows','Muqarnas are honeycomb-like ceilings. A mashrabiya is a wooden lattice window that gives shade and lets air through.','knowledge','What does a mashrabiya do?','Gives shade and lets air through','Tells the time','Grinds grain',
 [[0,8,13,14,2,10,5],[0,8,11,12,2,9,11],[0,8,9,10,2,8,5],[0,8,7.4,8,2,7,11],[0,8,5.8,6,2,6,5],[0,8,4.2,4,2,5,11],[0,8,2,12,3,3,10]]],
['Coffee pot','Yemen, 15th century','People in Yemen were drinking coffee by the 15th century. It spread around the world from the port of Mocha.','knowledge','From which port did coffee spread around the world?','Mocha','Aleppo','Cairo',
 [[0,8,2.5,9,3,9,0],[0,8,7,7,6,7,1],[0,8,11.5,5,3,5,0],[0,8,14,3,2,3,1],[0,3,10.5,4,1.6,4,1],[0,13,8,1.6,8,3,6],[0,8,8,7,.8,8,0]]]];
const FLOOR_OF=EXP.map(e=>e[0]);
const FLOOR_IDS=[0,1,2,3].map(f=>FLOOR_OF.reduce((a,v,i)=>v===f?a.concat(i):a,[]));
let EXH=null,MLM=null;
function museumLm(){if(!MLM)MLM=fixedList().find(l=>l.t==='museum');return MLM}
function exInit(){
 if(EXH)return;const l=museumLm();EXH=EXP.map((e,i)=>{const X=e[0]<2?22:18,wx=l.x+e[1]*X,wz=l.z+e[2]-MZC,y=l.y0+e[0]*6+2;return{i,f:e[0],wx,wz,y,cx:wx+.5,cz:wz+.5}});
}
const bcx=()=>museumLm().x+.5,bcz=()=>museumLm().z-MZC+.5;
/* passport state: S.pass = string of 26 chars: 0 none, 1 stamped, 2 stamped + quiz answered right */
const passN=()=>{let n=0;for(let i=0;i<26;i++)if(S.pass[i]!=='0')n++;return n};
const floorDone=f=>FLOOR_IDS[f].every(i=>S.pass[i]!=='0');
const EXQ_DEF=1/3;let EXQ=EXQ_DEF;
let museumLit=0,exNear=-1,mFloor=-1,mNear=false;
const exo={x:0,y:0,z:0,yaw:0},exAmb=[1,1,1];
function museumInfo(){
 /* where the player is relative to the museum: -1 outside, 0..3 floors, 4 roof */
 const dx=player.x-bcx(),dz=player.z-bcz(),l=museumLm();
 mNear=dx*dx+dz*dz<62*62;if(!mNear&&exPhCache.size)exPhCache.clear();
 if(Math.abs(dx)>24||Math.abs(dz)>24){mFloor=-1;return}
 const rel=player.y-l.y0-1;
 if(rel<-1||rel>35){mFloor=-1;return}
 mFloor=rel>=23.5?4:Math.max(0,Math.min(3,Math.floor((rel+.7)/6)));
 if(mFloor<4&&Math.abs(dx)>23.2||Math.abs(dz)>23.2)mFloor=mFloor<0?-1:mFloor;
}
function fillExGeo(now){
 if(!mNear)return;exInit();
 const t=now*.001;
 for(let c=0;c<3;c++)exAmb[c]=Math.max(sky.amb[c],.82);
 partAmb=exAmb;
 for(const e of EXH){
  const dx=e.cx-player.x,dz=e.cz-player.z;if(dx*dx+dz*dz>196||Math.abs(e.y-player.y)>5)continue;
  exo.x=e.cx;exo.y=e.y+.04;exo.z=e.cz;exo.yaw=t*.7+e.i;
  const M=EXD[e.i][8],sc=.052;
  for(const p of M){
   const c=PAL[p[6]],ox=(p[1]-8)*sc,oy=p[2]*sc,hx=p[3]*sc/2,hy=p[4]*sc/2,hz=p[5]*sc/2;
   if(p[0]){part(exo,ox,oy,0,hx*.82,hy,hz,c);part(exo,ox,oy,0,hx,hy*.82,hz,c)}else part(exo,ox,oy,0,hx,hy,hz,c);
  }
  if(e.i===exNear){exo.y=e.y+1.15+Math.sin(t*3)*.08;exo.yaw=t*2.2;part(exo,0,0,0,.14,.2,.14,PAL[0]);exo.y=e.y+1.15+Math.sin(t*3)*.08;part(exo,0,0,0,.2,.07,.2,PAL[0])}
 }
 if(plaqueNear()){exo.x=bcx()+PLAQUE.mx;exo.z=bcz()+PLAQUE.mz-MZC+MZC;exo.y=museumLm().y0+27+.04;exo.yaw=t*.7;
  const tel=[[0,0,.1,.5,.1,.5,9],[0,0,.46,.14,.8,.14,1],[0,0,.9,.1,.1,.4,9]];for(const p of tel)part(exo,p[0],p[1]+.2,p[2]-.1,p[3],p[4],p[5],PAL[p[6]]);
  exo.yaw=0}
 partAmb=sky.amb;
}
const plaqueNear=()=>mFloor===4&&Math.hypot(player.x-(bcx()+PLAQUE.mx),player.z-(bcz()+PLAQUE.mz))<7;
/* ray test against the case column of every exhibit near the player: returns {i,t} */
function exPick(o,d){
 if(!mNear||!EXH)return null;
 let best=-1,bt=1e9;
 for(const e of EXH){
  const dx=e.cx-o[0],dz=e.cz-o[2];if(dx*dx+dz*dz>64)continue;
  const mn=[e.wx-.3,e.y-1,e.wz-.3],mx=[e.wx+1.3,e.y+1.2,e.wz+1.3];let t0=0,t1=9,ok=true;
  for(let a=0;a<3;a++){
   if(Math.abs(d[a])<1e-6){if(o[a]<mn[a]||o[a]>mx[a]){ok=false;break}continue}
   let ta=(mn[a]-o[a])/d[a],tb=(mx[a]-o[a])/d[a];if(ta>tb){const q=ta;ta=tb;tb=q}
   t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1){ok=false;break}
  }
  if(ok&&t0<bt){bt=t0;best=e.i}
 }
 if(plaqueNear()){const px=bcx()+PLAQUE.mx,pz=bcz()+PLAQUE.mz-MZC+MZC,y=museumLm().y0+25;
  const mn=[px-.5,y,pz-.5],mx=[px+.5,y+2,pz+.5];let t0=0,t1=9,ok=true;
  for(let a=0;a<3;a++){if(Math.abs(d[a])<1e-6){if(o[a]<mn[a]||o[a]>mx[a]){ok=false;break}continue}
   let ta=(mn[a]-o[a])/d[a],tb=(mx[a]-o[a])/d[a];if(ta>tb){const q=ta;ta=tb;tb=q}t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1){ok=false;break}}
  if(ok&&t0<bt){bt=t0;best=26}}
 return best>=0?{i:best,t:bt}:null;
}
function drawExhibit(cv,M){
 const g=cv.getContext('2d'),W=cv.width,k=W/16;
 const bg=g.createLinearGradient(0,0,0,W);bg.addColorStop(0,'#f6e8c6');bg.addColorStop(1,'#ead29c');g.fillStyle=bg;g.fillRect(0,0,W,W);
 g.fillStyle='rgba(14,90,99,.12)';g.save();g.translate(W/2,W/2);for(let r=0;r<2;r++){g.rotate(Math.PI/4);g.fillRect(-W*.46,-W*.46,W*.92,W*.92)}g.restore();
 g.lineWidth=Math.max(1.5,W/90);g.strokeStyle='rgba(27,42,45,.55)';
 for(const p of M){
  g.fillStyle=palCss(p[6]);const w=p[3]*k,h=p[4]*k,x=p[1]*k-w/2,y=W-p[2]*k-h/2;
  g.beginPath();if(p[0])g.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,7);else g.rect(x,y,w,h);g.fill();g.stroke();
 }
}
function stampEx(i){
 if(S.pass[i]!=='0')return null;
 S.pass=S.pass.slice(0,i)+'1'+S.pass.slice(i+1);S.stars++;S.skills.museum++;updateHud();sfx.chime();queueSave();
 const out={f:-1,all:false,block:0};
 const f=FLOOR_OF[i];
 if(floorDone(f)&&!S.passFl[f]){
  S.passFl[f]=1;S.stars+=5;out.f=f;
  const nu=[B.LIME,B.LIMEP].concat(CHEST_UNLOCKS).find(b=>!S.unlocked.includes(b));if(nu!==undefined){S.unlocked.push(nu);out.block=nu;buildHotbar()}
 }
 if(passN()===26&&!S.title){S.title=1;S.stars+=5;out.all=true}
 updateHud();return out;
}
function openExhibit(i){
 if(curModal||!playing)return;
 if(i===26){skylinePlaque();return}
 const d=EXD[i],first=S.pass[i]==='0',r=stampEx(i);
 const tail=first?`<div class="why"><b>Passport stamped! +1 star</b><br>${passN()} of 26 stamps</div>`:'<p class="sm">You already have this stamp.</p>';
 modal(`<div class="exw"><canvas id="exc" class="exc" width="300" height="300"></canvas></div><div class="exph" style="display:none"><span class="seg"><button class="on" data-ph="1">Photo</button><button data-ph="0">Drawing</button></span><div class="cr"></div><a class="src" target="_blank" rel="noopener">Source</a></div><h2>${d[0]}</h2><span class="tag">${d[1]}</span><p>${d[2]}</p>${tail}<div class="row"><button class="btn" data-a="ok">Got it</button></div>`,p=>{
  drawExhibit(p.querySelector('#exc'),d[8]);
  const my=++exTok;
  exPhotoLoad(i+1,(im,ph)=>{
   if(my!==exTok||!p.isConnected)return;
   const w=p.querySelector('.exw'),bx=p.querySelector('.exph');if(!w||!bx)return;
   const ig=im.cloneNode(false);ig.className='exi';ig.alt='';w.appendChild(ig);
   bx.style.display='block';bx.querySelector('.cr').textContent=ph.credit;
   const a=bx.querySelector('.src');a.href=ph.page;
   a.onclick=e=>{e.preventDefault();let o=null;try{o=window.open(ph.page,'_blank')}catch(x){}
    if(o){try{o.opener=null}catch(x){}}else{const t=document.createElement('span');t.className='srcu';t.textContent=ph.page;a.replaceWith(t)}};
   const bt=bx.querySelectorAll('[data-ph]');
   bt.forEach(b=>b.onclick=()=>{const on=b.dataset.ph==='1';ig.classList.toggle('on',on);bt.forEach(q=>q.classList.toggle('on',q===b))});
   requestAnimationFrame(()=>requestAnimationFrame(()=>ig.classList.add('on')));
  });
  p.querySelector('[data-a=ok]').onclick=()=>{
   closeModal();
   if(r&&r.f>=0)floorDoneCard(r.f,r.block,r.all);else if(r&&r.all)floorDoneCard(-1,0,true);
   if(S.pass[i]==='1'&&Math.random()<EXQ)exQuiz(i);
  };
 });
 if(first)confetti();
}
function floorDoneCard(f,block,all){
 const nm=f>=0?`${MFLOORS[f][0]}: ${MFLOORS[f][1]}`:'';
 modal(`<svg class="motif i"><use href="#star8"/></svg><h2>${all?'Museum Explorer!':'Floor complete!'}</h2>${f>=0?`<p>You collected every stamp on ${nm}. +5 stars.</p>`:''}
  ${block?`<p><b>New block unlocked: ${DEFS[block].name}</b></p>`:''}${all?'<p>You found all 26 treasures. You are now a <b>Museum Explorer</b>! +5 stars.</p>':'<p>Well done, keep exploring.</p>'}<div class="row"><button class="btn" data-a="ok">Wonderful</button></div>`,p=>{p.querySelector('[data-a=ok]').onclick=closeModal});
 sfx.done();confetti();
}
function exQuizOpts(i){const d=EXD[i],o=shuffle([d[5],d[6],d[7]]);return{opts:o,a:o.indexOf(d[5])}}
function exQuiz(i){
 const d=EXD[i],q=exQuizOpts(i);
 modal(`<span class="tag">Museum question</span><div class="q">${d[4]}</div><div id="answers">${q.opts.map((o,k)=>`<button class="ans" data-i="${k}">${o}</button>`).join('')}</div><div id="result"></div>`,p=>{
  p.querySelectorAll('.ans').forEach(btn=>btn.onclick=()=>{
   const k=+btn.dataset.i,ok=k===q.a;
   p.querySelectorAll('.ans').forEach((b,j)=>{b.disabled=true;if(j===q.a)b.classList.add('ok');else if(j===k)b.classList.add('bad')});
   const res=p.querySelector('#result');
   if(ok&&S.pass[i]==='1'){S.pass=S.pass.slice(0,i)+'2'+S.pass.slice(i+1);S.stars+=2;S.skills[d[3]]++;sfx.right();updateHud();queueSave();
    res.innerHTML=`<div class="why"><b>Well done! +2 stars</b><br>${d[2].split('. ')[0].replace(/\.$/,'')}.</div><div class="row"><button class="btn" data-a="x">Continue</button></div>`}
   else{sfx.wrong();res.innerHTML=`<div class="why"><b>Not this time, and that is okay!</b><br>The answer is ${d[5]}.</div><div class="row"><button class="btn" data-a="x">Close</button></div>`}
   res.querySelector('[data-a=x]').onclick=closeModal;
  });
 });
}
const SKY_NAMES=[['Grand Mosque',0],['Blue-dome Mosque',1],['Small turquoise Mosque',2],['Green-dome Mosque',3],['Garden with a domed pavilion',5],['Village masjid',6],['Caravanserai',7]];
const DIR8=['north','north-east','east','south-east','south','south-west','west','north-west'];
function skylinePlaque(){
 const l=museumLm(),ls=fixedList(),rows=[];
 for(const n of SKY_NAMES){const o=ls[n[1]],dx=o.x-l.x,dz=o.z-(l.z-MZC),a=Math.atan2(dx,-dz),k=((Math.round(a/(Math.PI/4))%8)+8)%8;rows.push(`<div class="skill"><span>${n[0]}</span><b>${DIR8[k]}</b></div>`)}
 modal(`<svg class="motif i"><use href="#star8"/></svg><h2>Skyline</h2><p>From the roof terrace you can see these places:</p>${rows.join('')}<div class="row"><button class="btn" data-a="ok">Got it</button></div>`,p=>{p.querySelector('[data-a=ok]').onclick=closeModal});
}
function passportPanel(){
 let h=`<h2>Museum Passport</h2><p><b>${passN()} of 26</b> stamps${S.title?' - <b>Museum Explorer</b>':''}</p>`;
 for(let f=0;f<4;f++){
  const ids=FLOOR_IDS[f],got=ids.filter(i=>S.pass[i]!=='0').length;
  h+=`<div class="pfl"><b>${MFLOORS[f][0]}</b> <span>${MFLOORS[f][1]}</span> <i>${got}/${ids.length}</i></div><div class="pgrid">${ids.map(i=>`<span class="stamp${S.pass[i]!=='0'?' on':''}" title="${EXD[i][0]}" data-i="${i}">${S.pass[i]!=='0'?'<svg class="i"><use href="#star8"/></svg>':i+1}</span>`).join('')}</div>`;
 }
 h+='<div class="row"><button class="btn" data-a="ok">Close</button></div>';
 modal(h,p=>{p.querySelector('[data-a=ok]').onclick=closeModal});
}
/* HUD chips and labels, updated each frame while near the museum */
let mLabs=null,mlabLast='';
function museumHud(dt){
 museumInfo();
 const tgt=mFloor>=0?1:0;museumLit+=(tgt-museumLit)*Math.min(1,dt*3);
 const box=$('mchips');
 if(!mLabs){mLabs=[];const tg=$('tags');for(let i=0;i<4;i++){const d=document.createElement('div');d.className='ntag mlab';d.innerHTML='<span></span><button class="hb">Tap to learn</button>';d.style.display='none';tg.appendChild(d);mLabs.push({d,s:d.firstChild,b:d.lastChild,txt:'',shown:false,i:-1});d.lastChild.onclick=e=>{e.stopPropagation();if(mLabs[i].i>=0)openExhibit(mLabs[i].i)}}}
 const show=playing&&!curModal&&mNear;
 let txt='';
 if(show&&mFloor>=0)txt=mFloor===4?'Museum \u2014 Roof terrace: Skyline':`Museum \u2014 ${MFLOORS[mFloor][0]}: ${MFLOORS[mFloor][1]}`;
 box.style.display=show?'flex':'none';
 if(txt!==mlabLast){mlabLast=txt;$('floorchip').textContent=txt;$('floorchip').style.display=txt?'flex':'none'}
 exNear=-1;
 for(const L of mLabs)L.want=false;
 if(!show){for(const L of mLabs)if(L.shown){L.shown=false;L.d.style.display='none'}return}
 exInit();
 /* nearest exhibit that is close and roughly in front */
 let bd=36,bi=-1;
 if(mFloor>=0)for(const e of EXH){const dx=e.cx-player.x,dz=e.cz-player.z,dd=dx*dx+dz*dz;if(dd<bd&&Math.abs(e.y-player.y-1)<4){bd=dd;bi=e.i}}
 exNear=bi;
 const slots=[];
 if(bi>=0)slots.push([bi,EXH[bi].cx,EXH[bi].y+1.7,EXH[bi].cz,EXD[bi][0],true]);
 else if(plaqueNear())slots.push([26,bcx()+PLAQUE.mx,museumLm().y0+28.2,bcz()+PLAQUE.mz,'Skyline',true]);
 /* doorway labels */
 if(mFloor>=0&&mFloor<4){const l=museumLm(),f=mFloor;
  for(const s of[-1,1]){const x=bcx()+s*11,z=bcz()-6,dx=x-player.x,dz=z-player.z;if(dx*dx+dz*dz<22*22)slots.push([-1,x,l.y0+f*6+5.6,z,f===0?(s<0?'Stars and Numbers: astronomy and maths':'Stars and Numbers: light and machines'):f===1?(s<0?'The Art of the Book':'Healing'):f===2?'Fire, Clay and Thread':'Journeys and Buildings',false])}
 }
 if(mFloor<0){const l=museumLm(),x=bcx(),z=bcz()+25,dx=x-player.x,dz=z-player.z;if(dx*dx+dz*dz<60*60)slots.push([-1,x,l.y0+8,z,'Museum of Islamic Heritage',false])}
 for(let k=0;k<4;k++){
  const L=mLabs[k],sl=slots[k];let on=false;
  if(sl){const p=project(sl[1],sl[2],sl[3]);
   if(p&&p[0]>-1.1&&p[0]<1.1&&p[1]>-1.1&&p[1]<1.1){on=true;
    if(sl[4]!==L.txt){L.txt=sl[4];L.s.textContent=sl[4]}
    const showB=sl[5];if(L.hb!==showB){L.hb=showB;L.b.style.display=showB?'block':'none'}
    L.i=sl[0];
    const px=Math.round((p[0]*.5+.5)*vw),py=Math.round((.5-p[1]*.5)*vh);
    if(px!==L.px||py!==L.py){L.px=px;L.py=py;L.d.style.transform='translate('+px+'px,'+py+'px) translate(-50%,-100%)'}
   }}
  if(on!==L.shown){L.shown=on;L.d.style.display=on?'block':'none'}
 }
}
window.__mus=()=>{exInit();const l=museumLm();return{x:l.x,z:l.z,y0:l.y0,bx:bcx(),bz:bcz(),ex:EXH.map(e=>({i:e.i,f:e.f,wx:e.wx,wz:e.wz,y:e.y,name:EXD[e.i][0]})),floor:mFloor,pass:S.pass,fl:S.passFl,title:S.title}};

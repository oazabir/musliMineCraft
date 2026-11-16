
/* ===== 9. Knowledge chests and quiz bank ===== */
const LETTERS=[['ا','Alif'],['ب','Ba'],['ت','Ta (light)'],['ث','Tha'],['ج','Jeem'],['ح','Haa (throaty)'],['خ','Khaa'],['د','Dal'],['ذ','Dhal'],['ر','Ra'],['ز','Zay'],['س','Seen'],['ش','Sheen'],['ص','Sad (heavy)'],['ض','Dad (heavy)'],['ط','Taa (heavy)'],['ظ','Dhaa (heavy)'],['ع','Ain'],['غ','Ghain'],['ف','Fa'],['ق','Qaf'],['ك','Kaf'],['ل','Lam'],['م','Meem'],['ن','Noon'],['ه','Ha (light)'],['و','Waw'],['ي','Ya']];
/* [category, difficulty 0-2, question, correct answer, two wrong answers, explanation] */
const FACTS=[
 ['science',1,'Which invention uses a tiny hole to show an upside-down picture of the outside world?','Camera obscura',['Windmill','Water clock'],'Ibn al-Haytham studied the camera obscura. Light goes through a tiny hole and makes a picture on the wall.'],
 ['knowledge',1,'What is a muqarnas?','A honeycomb-like decoration in a dome or arch',['A kind of date palm','A water pump'],'Muqarnas are stacked little niches that make domes and arches look like honeycombs.'],
 ['knowledge',1,'What is a mashrabiya?','A carved wooden screen that lets in air and light',['A type of boat','A tall prayer tower'],'A mashrabiya screen keeps rooms shady and cool while air still flows through.'],
 ['knowledge',1,'The Great Mosque of Cordoba is famous for its many arches. What colours are they?','Red and white stripes',['Blue and green swirls','Black and gold dots'],'The arches of the Great Mosque of Cordoba have red and white stripes.'],
 ['knowledge',1,'Zellige tiles are famous in which country?','Morocco',['Iceland','Canada'],'Zellige is made of small cut tiles that fit together into bright patterns. It is famous in Morocco.'],
 ['knowledge',1,'The town of Iznik is famous for painted what?','Tiles and pottery',['Swords','Boats'],'Iznik is known for beautiful painted tiles and pots with blue, turquoise and red flowers.'],
 ['science',1,'Al-Idrisi is remembered for making a famous what?','Map of the world',['Water clock','Book of recipes'],'Al-Idrisi made a famous world map and wrote about far-away lands.'],
 ['knowledge',0,'Ibn Battuta is famous for what?','Travelling and writing about his journeys',['Painting domes','Making astrolabes'],'Ibn Battuta travelled across many lands and wrote about the places and people he met.'],
 ['knowledge',1,'The Alhambra is a famous palace in which country?','Spain',['Egypt','India'],'The Alhambra is a palace and garden in Granada, Spain, known for patterned walls and courtyards.'],
 ['science',1,'A bimaristan was a place that did what?','Cared for sick people',['Taught sailing','Kept camels'],'A bimaristan was a hospital. Doctors there cared for patients and taught students.'],
 ['science',1,'Which scholar wrote a famous book about algebra?','Al-Khwarizmi',['Al-Jazari','Ibn Sina'],'Al-Khwarizmi wrote about algebra long ago in Baghdad.'],
 ['science',1,'The word "algorithm" comes from the name of which scholar?','Al-Khwarizmi',['Al-Biruni','Ibn al-Haytham'],'The word algorithm comes from the name of Al-Khwarizmi.'],
 ['science',1,'Ibn al-Haytham explained how we see. What did he show?','Light bounces off things into our eyes',['Our eyes shoot out beams','Things glow by themselves'],'Ibn al-Haytham studied light and showed that we see when light enters our eyes. This is called optics.'],
 ['science',1,'Who built clever machines and water clocks and wrote a book about them?','Al-Jazari',['Al-Khwarizmi','Fatima al-Fihri'],'Al-Jazari was an engineer who designed ingenious machines, including water clocks.'],
 ['science',0,'Who founded the al-Qarawiyyin school in the city of Fez?','Fatima al-Fihri',['Maryam al-Ijliyya','Ibn Sina'],'Fatima al-Fihri founded al-Qarawiyyin in Fez. It is one of the oldest universities in the world.'],
 ['science',1,'Ibn Sina wrote a very famous book about which subject?','Medicine',['Cooking','Sailing'],'Ibn Sina wrote The Canon of Medicine, which doctors studied for hundreds of years.'],
 ['science',2,'Which scholar estimated the size of the Earth?','Al-Biruni',['Al-Jazari','Fatima al-Fihri'],'Al-Biruni used maths and careful measuring to estimate the size of the Earth.'],
 ['science',2,'Maryam al-Ijliyya was a skilled maker of what?','Astrolabes',['Water clocks','Sailing boats'],'Maryam al-Ijliyya made astrolabes, tools used to study the stars, in the city of Aleppo.'],
 ['science',0,'In which city was the famous House of Wisdom?','Baghdad',['Cairo','Cordoba'],'The House of Wisdom in Baghdad was a place where scholars studied, translated and shared books.'],
 ['science',1,'Scholars writing in which language helped bring the numbers we use today, with zero, to Europe?','Arabic',['Old Norse','Japanese'],'Scholars writing in Arabic helped spread the number system with zero to Europe.'],
 ['science',2,'What was an astrolabe used for?','Finding time and the position of stars',['Weighing gold','Cutting wood'],'An astrolabe helped people find the time, the direction and the stars in the sky.'],
 ['science',0,'Which of these English words came from Arabic?','Sugar',['Window','Bread'],'The word sugar comes from the Arabic word sukkar.'],
 ['science',1,'Which English word comes from the Arabic word "al-jabr"?','Algebra',['Alphabet','Geometry'],'Algebra comes from al-jabr, a word in a book by Al-Khwarizmi.'],
 ['science',0,'Which of these English words travelled from Arabic into English?','Lemon',['House','Water'],'The word lemon comes from Arabic, from the word laymun.'],
 ['science',1,'Which one of these English words has an Arabic origin?','Cotton',['Bridge','Stone'],'Cotton is a soft plant fibre. Its name comes from the Arabic word qutn.'],
 ['knowledge',0,'How many prayers do Muslims pray each day?','Five',['Three','Seven'],'Muslims pray five times a day.'],
 ['knowledge',0,'Which prayer is prayed just before sunrise?','Fajr',['Isha','Asr'],'Fajr is the dawn prayer, before sunrise.'],
 ['knowledge',0,'Which prayer is prayed at sunset?','Maghrib',['Dhuhr','Fajr'],'Maghrib is prayed just after the sun sets.'],
 ['knowledge',0,'Which prayer is prayed after the sun passes its highest point?','Dhuhr',['Fajr','Maghrib'],'Dhuhr is prayed in the middle of the day.'],
 ['knowledge',1,'Which prayer is prayed in the late afternoon?','Asr',['Fajr','Isha'],'Asr is prayed in the late afternoon.'],
 ['knowledge',1,'Which prayer is prayed at night?','Isha',['Dhuhr','Asr'],'Isha is the night prayer.'],
 ['knowledge',0,'How many pillars of Islam are there?','Five',['Four','Ten'],'Islam has five pillars.'],
 ['knowledge',0,'Ramadan is the month of what?','Fasting',['Travelling','Harvest'],'In Ramadan, Muslims fast from dawn until sunset.'],
 ['knowledge',0,'In which city is the Kaaba?','Makkah',['Cairo','Istanbul'],'The Kaaba is in Makkah.'],
 ['knowledge',1,'What is the direction of prayer called?','Qibla',['Minaret','Mihrab'],'The qibla is the direction towards the Kaaba in Makkah.'],
 ['knowledge',0,'What does "As-salamu alaykum" mean?','Peace be upon you',['Good night','Thank you'],'It is a kind greeting that means peace be upon you.'],
 ['knowledge',0,'What do we say before we start something?','Bismillah',['Alhamdulillah','Salam'],'We say Bismillah, which means in the name of Allah, before we begin.'],
 ['knowledge',0,'What do we say to give thanks?','Alhamdulillah',['Bismillah','Salam'],'Alhamdulillah means all praise and thanks are for Allah.'],
 ['knowledge',0,'How should we treat our parents?','With kindness and respect',['Ignore them','Argue with them'],'Being kind to our parents is a very good manner.'],
 ['knowledge',0,'Which is a kind thing to do for a neighbour?','Help them and share',['Make loud noise at night','Ignore them'],'Good neighbours are kind and helpful.'],
 ['knowledge',0,'What is a good habit with water?','Turn off the tap when finished',['Leave the tap running','Pour it on the ground'],'Water is precious, so we do not waste it.'],
 ['knowledge',0,'Planting a tree is...','A good deed that helps others',['A waste of time','Only for grown-ups'],'Trees give shade, fruit and homes for birds, so planting one is a good deed.'],
 ['knowledge',1,'The Hijri calendar follows which part of the sky?','The Moon',['The Sun','The wind'],'The Hijri calendar follows the phases of the Moon.'],
 ['knowledge',1,'How many months are in the Hijri year?','12',['10','13'],'The Hijri year has 12 months.'],
 ['knowledge',1,'An eight-point star can be made from...','Two overlapping squares',['Two circles','Three triangles'],'Turn one square and place it over another to make an eight-point star.'],
 ['knowledge',0,'What do palm trees grow?','Dates',['Oranges','Apples'],'Palm trees grow sweet dates.'],
 ['knowledge',0,'What is an oasis?','A place with water in a desert',['A very tall mountain','A kind of boat'],'An oasis is a green place where water is found in a desert.']
];
const SHAPES=[['triangle',3],['square',4],['pentagon',5],['hexagon',6],['octagon',8]];
function mathQuestion(t){
 const k=ri(0,5);let text,ans,why;
 const m=[10,30,100][t];
 if(k===0){const a=ri(1,m),b=ri(1,m);text=`${a} + ${b} = ?`;ans=a+b;why=`${a} + ${b} = ${ans}.`}
 else if(k===1){const a=ri(Math.min(5,m),m),b=ri(1,a);text=`${a} - ${b} = ?`;ans=a-b;why=`${a} - ${b} = ${ans}.`}
 else if(k===2){const a=t===0?pick([2,5,10]):ri(2,[0,6,12][t]),b=ri(2,t===0?5:12);text=`${a} x ${b} = ?`;ans=a*b;why=`${a} x ${b} = ${ans}.`}
 else if(k===3){if(Math.random()<.5){const a=ri(1,10*(t+1));text=`What is double ${a}?`;ans=a*2;why=`Double ${a} is ${a} + ${a} = ${ans}.`}
  else{const a=ri(1,5*(t+1))*2;text=`What is half of ${a}?`;ans=a/2;why=`Half of ${a} is ${ans}.`}}
 else if(k===4){const s=pick(SHAPES.slice(0,t?5:3));text=`How many sides does a ${s[0]} have?`;ans=s[1];why=`A ${s[0]} has ${ans} sides.`}
 else{const s=pick(['square','rectangle']);text=`How many right angles does a ${s} have?`;ans=4;why=`A ${s} has 4 right angles.`}
 const w=new Set();while(w.size<2){const v=ans+pick([-3,-2,-1,1,2,3,10,-10]);if(v>=0&&v!==ans)w.add(v)}
 return mk('maths',text,'',String(ans),[...w].map(String),why);
}
function mk(cat,text,glyph,right,wrong,why){
 const opts=shuffle([right,...wrong]);
 return{cat,text,glyph,opts,a:opts.indexOf(right),why};
}
function letterQuestion(){
 const L=pick(LETTERS),others=shuffle(LETTERS.filter(l=>l!==L)).slice(0,2);
 return mk('arabic','Which letter is this?',L[0],L[1],others.map(o=>o[1]),`This letter is called ${L[1]}.`);
}
const recent=[];
function nextQuestion(){
 const tier=S.stars<15?0:S.stars<50?1:2,r=Math.random();
 let q;
 if(r<.3)q=mathQuestion(tier);
 else if(r<.5)q=letterQuestion();
 else{
  const pool=FACTS.filter(f=>f[1]<=tier&&!recent.includes(f[2]));
  const f=pick(pool.length?pool:FACTS);
  recent.push(f[2]);if(recent.length>10)recent.shift();
  q=mk(f[0],f[2],'',f[3],f[4],f[5]);
 }
 return q;
}
const CAT_NAMES={maths:'Maths',arabic:'Arabic letters',science:'Science heritage',knowledge:'Knowledge'};
const CHEST_UNLOCKS=[B.STAR,B.GLASS,B.CARPET,B.LATTICE,B.GREEN,B.GOLD,B.LANTERN,B.SHELF,B.BLUE,B.MARBLE];
function openChest(x,y,z){
 const q=nextQuestion();
 modal(`<span class="tag">${CAT_NAMES[q.cat]}</span>${q.glyph?`<div class="glyph">${q.glyph}</div>`:''}<div class="q">${q.text}</div>
  <div id="answers">${q.opts.map((o,i)=>`<button class="ans" data-i="${i}">${o}</button>`).join('')}</div><div id="result"></div>`,
  p=>{
   p.querySelectorAll('.ans').forEach(btn=>btn.onclick=()=>{
    const i=+btn.dataset.i,ok=i===q.a;
    p.querySelectorAll('.ans').forEach((b,j)=>{b.disabled=true;if(j===q.a)b.classList.add('ok');else if(j===i)b.classList.add('bad')});
    const res=p.querySelector('#result');
    if(ok){
     S.stars+=3;S.skills[q.cat]++;sfx.right();confetti();
     setBlock(x,y,z,0,2);beamsDirty=true;
     const nu=CHEST_UNLOCKS.find(b=>!S.unlocked.includes(b));
     let extra='';if(nu){S.unlocked.push(nu);extra=`<p><b>New block unlocked: ${DEFS[nu].name}</b></p>`}
     res.innerHTML=`<div class="why"><b>Well done! +3 stars</b><br>${q.why}</div>${extra}<div class="row"><button class="btn" data-a="x">Continue</button></div>`;
     updateHud();buildHotbar();queueSave();
    }else{
     sfx.wrong();
     res.innerHTML=`<div class="why"><b>Not this time, and that is okay!</b><br>The answer is ${q.opts[q.a]}. ${q.why}<br>The chest is still here. Try again!</div><div class="row"><button class="btn" data-a="x">Close</button></div>`;
    }
    res.querySelector('[data-a=x]').onclick=closeModal;
   });
  });
}

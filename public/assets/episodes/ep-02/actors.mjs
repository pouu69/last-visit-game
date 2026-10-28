/** Full-volume station cast; floor-centred, Y-up, +Z front. */
import { episodeKit } from './model-kit.mjs';
export function createSeriesActors(core) {
  const {group,box,cylinder,sphere,beam,revolve,paint,material,end,factory,physical}=episodeKit(core,'ep-02');
  const skin=material('#d9ad89',{roughness:.93}), hair=material('#392f30',{roughness:.96});
  const outfits={
    munjeong:{coat:'#486252',pants:'#243b37',hair:'#392f30',accent:'#b18a54',height:1.68,body:.31,role:'station-guide'},
    neighbor:{coat:'#9f5844',pants:'#46594e',hair:'#704f40',accent:'#fff2c7',height:1.58,body:.27,role:'new-arrival'},
    sohui:{coat:'#527586',pants:'#243b37',hair:'#392f30',accent:'#b18a54',height:1.66,body:.29,role:'signal-lead'},
    jeongyeon:{coat:'#856258',pants:'#46594e',hair:'#243b37',accent:'#fff2c7',height:1.62,body:.28,role:'attendee'},
    taeo:{coat:'#704f40',pants:'#243b37',hair:'#392f30',accent:'#c3b99c',height:1.72,body:.34,role:'workshop-maker'},
    ideun:{coat:'#ddd6bd',pants:'#46594e',hair:'#392f30',accent:'#b18a54',height:1.7,body:.3,role:'equipment-steward'},
    narae:{coat:'#486252',pants:'#243b37',hair:'#9f5844',accent:'#fff2c7',height:1.61,body:.28,role:'host'},
  };
  const builders=Object.fromEntries(Object.entries(outfits).map(([id,look])=>[id,()=>{
    const root=group(`${id}-station-actor`), coat=material(look.coat,{roughness:.94}), pants=material(look.pants,{roughness:.94}), accent=material(look.accent,{roughness:.88});
    const torso=group(`${id}-torso`);torso.position.y=look.height*.56;root.add(torso);
    revolve(torso,coat,[[0,-.34],[look.body*.83,-.34],[look.body,-.28],[look.body*.88,.28],[look.body*.62,.38],[0,.39]],[0,0,0],[1,1,.78],12);
    box(torso,accent,[0,.13,look.body*.64],[.13,.2,.025]);
    // rear seam and pocket give the model a deliberate back view.
    box(torso,pants,[0,-.12,-look.body*.62],[.23,.13,.025]);
    const head=group(`${id}-head`);head.position.y=.46;torso.add(head);
    sphere(head,skin,[0,0,.015],[.17,.205,.15]);
    sphere(head,hair,[0,.1,-.025],[.18,.13,.16]);
    sphere(head,hair,[0,-.01,-.12],[.17,.15,.07]);
    for(const side of [-1,1]) {sphere(head,skin,[side*.16,0,.01],[.035,.06,.04]);sphere(head,paint.dark,[side*.06,.015,.154],[.012,.018,.009]);}
    const arms=[],legs=[];
    for(const side of [-1,1]){
      const arm=group(`${id}-arm-${side}`);arm.position.set(side*(look.body+.04),.2,0);torso.add(arm);
      revolve(arm,coat,[[0,-.34],[.055,-.34],[.07,-.07],[.075,.05],[0,.06]],[0,0,0],[1,1,.9],8);
      sphere(arm,skin,[0,-.39,.01],[.055,.075,.05]);arms.push(arm);
      const leg=group(`${id}-leg-${side}`);leg.position.set(side*.11,.52,0);root.add(leg);
      box(leg,pants,[0,-.22,0],[.13,.43,.15]);box(leg,paint.wood,[0,-.46,.04],[.17,.1,.26]);legs.push(leg);
    }
    if(id==='munjeong'||id==='neighbor') {
      // Distinctive folded route slip held against the front of the torso.
      const slip=box(torso,paint.paper,[.24,-.03,.04],[.14,.22,.025],[0,0,-.12]);slip.name=`${id}-route-note`;
    }
    if(id==='ideun') box(torso,paint.brass,[-.2,.02,-.05],[.08,.2,.04]);
    if(id==='narae') box(torso,paint.green,[0,-.31,-.01],[.22,.2,.2]);
    const result=end(root,id,.84,.58,look.height,{torso,head,arms,legs},[physical(.84,.58,look.height)]);
    root.userData.actorRole=look.role;
    return result;
  }]));
  return factory(builders);
}

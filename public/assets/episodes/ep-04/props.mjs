import { episodeKit } from '../ep-02/model-kit.mjs';
export function createEpisode04Props(core) {
  const {group,box,cylinder,sphere,beam,ring,revolve,p,glass,material,label,end,factory,physical,keep}=episodeKit(core,'ep-04');
  return factory({
    'guide-lamp'({lit=false,open=false,shade=0}={}) {
      const root=group('steady-guide-lamp');
      cylinder(root,p.brass,[0,.08,0],[.36,.12,.36]);
      const base=group('inspection-base');root.add(base);base.position.set(0,.02,-.3);
      cylinder(base,p.wood,[0,0,.3],[.32,.035,.32]);base.rotation.x=open?Math.PI*.65:0;
      const latch=box(root,p.brass,[.13,.13,.12],[.16,.05,.09]);keep(latch);
      cylinder(root,p.brass,[0,.21,0],[.045,.19,.045]);
      revolve(root,glass,[[.25,0],[.32,.06],[.35,.28],[.29,.5],[.17,.58],[.15,.6]],[0,.16,0]);
      const bulb=keep(sphere(root,material(lit?'#f7dc96':'#dbcdb0',{emissive:lit?'#f7d37a':'#000000',emissiveIntensity:lit?.65:0,roughness:.7}),[0,.42,0],[.09,.16,.09]));
      for(const y of [.18,.75])ring(root,p.brass,[0,y,0],y<.2?.27:.17,.025,[Math.PI/2,0,0]);
      const hood=group('adjustable-shade');root.add(hood);hood.position.set(0,.78,0);hood.rotation.y=shade;
      box(hood,p.green,[0,-.14,-.29],[.6,.38,.04],[.15,0,0]);
      for(const x of [-.3,.3])beam(root,p.brass,[x,.7,0],[x,1,0],.018);
      beam(root,p.wood,[-.3,1,0],[.3,1,0],.035);
      return end(root,'guide-lamp',.7,.72,1.05,{bulb,shade:hood,base,latch},[physical(.7,.72,.8)]);
    },
    'fixed-stand'() {
      const root=group('fixed-lamp-stand');
      box(root,p.wood,[0,.09,0],[.9,.18,.9]);
      cylinder(root,p.brass,[0,.6,0],[.075,1.05,.075]);
      cylinder(root,p.wood,[0,1.12,0],[.42,.08,.42]);
      for(const x of [-.25,.25])for(const z of [-.25,.25])beam(root,p.brass,[x,.16,z],[0,.68,0],.025);
      return end(root,'fixed-stand',.9,.9,1.16,{},[physical(.9,.9,1.16)]);
    },
    'carrying-base'() {
      const root=group('low-carrying-base');box(root,p.wood,[0,.23,0],[1,.15,.9]);
      for(const x of [-.43,.43])for(const z of [-.32,.32])cylinder(root,p.dark,[x,.12,z],[.12,.06,.12],[0,0,Math.PI/2]);
      for(const x of [-.42,.42])beam(root,p.brass,[x,.3,-.3],[x,.85,-.65],.025);
      beam(root,p.wood,[-.42,.85,-.65],[.42,.85,-.65],.035);
      return end(root,'carrying-base',1,1.15,.9,{},[physical(1,1.15,.9)]);
    },
    'hand-signs'() {
      const root=group('daylight-hand-signs');const signs=[];
      ['같이 출발 →','여기서 기다림'].forEach((text,i)=>{
        const sign=group(`hand-sign-${i}`);root.add(sign);sign.position.x=(i-.5)*.85;
        box(sign,p.wood,[0,.44,0],[.065,.87,.065]);
        const face=label(sign,text,[0,.95,.04],[.75,.42,.04]);
        box(sign,p.wood,[0,.03,0],[.42,.06,.4]);signs.push(sign);face.userData.role=i?'wait':'departure';
      });
      return end(root,'hand-signs',1.6,.4,1.18,{signs},[physical(1.6,.4,1.18)]);
    },
    'inspection-documents'() {
      const root=group('lamp-inspection-documents');
      label(root,'注文書 · 고정형\n그늘선 확인',[-.35,.03,0],[.7,.6,.018],[-Math.PI/2,0,0]);
      label(root,'고정 받침 / 낮은 운반대\n전원을 끈 뒤 운반 시험',[.4,.045,.04],[.7,.6,.018],[-Math.PI/2,0,0]);
      return end(root,'inspection-documents',1.5,.65,.06,{},[],'support-center');
    },
    'shade-panel'({angle=0}={}) { const root=group('adjustable-lamp-shade-panel'); const hinge=group('shade-hinge');root.add(hinge);hinge.position.set(0,.8,0);hinge.rotation.x=angle;box(hinge,p.green,[0,0,-.28],[.82,.62,.06]);for(const x of [-.4,.4])beam(hinge,p.brass,[x,-.3,0],[x,.3,-.52],.025); const pin=keep(cylinder(root,p.brass,[0,.8,0],[.07,.08,.07],[Math.PI/2,0,0]));return end(root,'shade-panel',.9,.65,1.15,{hinge,pin},[physical(.9,.65,.15)]); },
    'wall-lamp-mount'() { const root=group('fixed-wall-guide-lamp-mount'); box(root,p.wood,[0,0,-.08],[.7,.9,.16]); for(const y of [-.32,.32])cylinder(root,p.brass,[0,y,.02],[.07,.06,.07],[Math.PI/2,0,0]); const cradle=group('lamp-cradle');root.add(cradle);cylinder(cradle,p.brass,[0,.18,.25],[.28,.06,.28]); for(const x of [-.24,.24])beam(cradle,p.brass,[x,.15,.25],[x,.7,.25],.025);return end(root,'wall-lamp-mount',.7,.5,.9,{cradle},[physical(.7,.2,.9)],'wall-center'); },
  });
}

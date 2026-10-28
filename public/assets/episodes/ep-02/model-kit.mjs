/** Small authoring helpers shared by the sequel factories; no game-state mutations. */
export function episodeKit(core, episode) {
  const { THREE, group, box, material, finish } = core;
  const revision = `series-${episode}-2026-10-29`;
  const physical = (w, d, h, x = 0, z = 0, y = 0) => ({ minX:x-w/2,maxX:x+w/2,minY:y,maxY:y+h,minZ:z-d/2,maxZ:z+d/2 });
  const keep = (object) => (object.userData.keepMesh = true, object);
  function label(parent, text, position, size, rotation = [0,0,0], color = '#243b37', background = '#fff2c7') {
    const textures = parent.userData.assetTextures ??= [];
    const options = { roughness:.93 };
    if (typeof document !== 'undefined') {
      const canvas=document.createElement('canvas'); canvas.width=768; canvas.height=384;
      const context=canvas.getContext('2d');
      context.fillStyle=background; context.fillRect(0,0,768,384);
      context.fillStyle=color; context.textAlign='center'; context.textBaseline='middle';
      const lines=text.split('\n'); context.font=`600 ${Math.min(64,620/Math.max(...lines.map(x=>x.length)))}px sans-serif`;
      lines.forEach((line,i)=>context.fillText(line,384,192+(i-(lines.length-1)/2)*90,700));
      const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
      textures.push(texture); options.map=texture;
    }
    const face=keep(box(parent,material(background,options),position,size,rotation));
    face.name=`label-${text.replace(/\s+/g,'-')}`; face.userData.labelText=text;
    return face;
  }
  function end(root,id,w,d,h,parts={},colliders=[],pivot='floor-center') {
    const result=finish(root,id,{footprint:[w,d],height:h,parts,colliders,pivot});
    root.userData.assetRevision=revision; root.userData.episodeId=episode;
    return result;
  }
  function factory(builders) {
    return {revision, ids:Object.freeze(Object.keys(builders)),create(id,options={}) {
      if(!Object.hasOwn(builders,id)) throw new Error(`Unknown ${episode} asset ${id}`);
      return builders[id](options);
    }};
  }
  return { ...core, p:core.paint, revision, physical, keep, label, end, factory, group };
}

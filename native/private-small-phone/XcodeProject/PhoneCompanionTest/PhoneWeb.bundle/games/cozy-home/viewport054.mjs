// Avoid resetting the Safari drawing buffer on unchanged visualViewport events.
// Apply dimensions and DPR together, retaining the user's chosen HD pixel count.
export function createViewportSizer({renderer,camera,interactionCamera,composer,ao,resolution,readSize,onHeight}){
 let previous=null,changes=0;
 function resize(force=false){
  const {width,height}=readSize(),dpr=resolution(width,height);
  if(force!==true&&previous&&previous.width===width&&previous.height===height&&previous.dpr===dpr)return false;
  camera.aspect=width/height;camera.updateProjectionMatrix();interactionCamera.aspect=camera.aspect;interactionCamera.updateProjectionMatrix();
  renderer.setDrawingBufferSize(width,height,dpr);composer?.setSize(width,height);ao?.setSize(Math.round(width*.7),Math.round(height*.7));onHeight(height);
  previous={width,height,dpr};changes++;return true;
 }
 return {resize,snapshot:()=>({...previous,changes})};
}

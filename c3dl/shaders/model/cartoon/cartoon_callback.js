/*
  Copyright (c) 2008 Seneca College
  Licenced under the MIT License (http://www.c3dl.org/index.php/mit-license/)
*/


/*
*/
c3dl.cartoon_callback = function(renderingObj)
{
  var renderer = renderingObj.getRenderer();
  var gl = renderingObj.getContext();
  var geometry = renderingObj.getGeometry();
  var effect = geometry.getEffect();
  var programObjID = renderingObj.getProgramObjectID();

  gl.useProgram(programObjID);

  if(effect.getParameter("qMap") == null)
  {
    c3dl.debug.logWarning('"qMap" is a required parameter for c3dl.effects.CARTOON');
    return;
  }

  var modelViewMatrix = c3dl.peekMatrix();
  c3dl.matrixMode(c3dl.PROJECTION);
  var projectionMatrix = c3dl.peekMatrix();
  c3dl.matrixMode(c3dl.MODELVIEW);

  // create a ModelViewProjection matrix.  By doing this, we can multiply
  // 3 matrices together once per model instead of once per vertex
  var modelViewProjMatrix = c3dl.multiplyMatrixByMatrix(projectionMatrix, modelViewMatrix);
  renderer.setUniformMatrix(programObjID, "modelViewMatrix", modelViewMatrix);
  renderer.setUniformMatrix(programObjID, "modelViewProjMatrix", modelViewProjMatrix);
  
  // Commenting out until a fix is solved for the 2-object outline bug

  // Only render the outline, which is a single pixel thick if the user
  // wants it and the effect exists.
  if(effect.getParameter("outline") == true && renderer.SOLID_COLOR_EFFECT_ID)
  {
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2.0, 2.0);

    // use the solid color effect since it's fast and we don't have
    // to send unnecessary data.
    var outlineProgID = renderer.SOLID_COLOR_EFFECT_ID;

    gl.enable(gl.CULL_FACES);
    gl.cullFace(gl.FRONT);
    gl.useProgram(outlineProgID);
    renderer.setUniformf(outlineProgID, "color",[0,0,0]);

    var modelViewMatrix = c3dl.peekMatrix();
    c3dl.matrixMode(c3dl.PROJECTION);
    var projectionMatrix = c3dl.peekMatrix();
    c3dl.matrixMode(c3dl.MODELVIEW);

    var MVPMatrix = c3dl.multiplyMatrixByMatrix(projectionMatrix, modelViewMatrix);
    renderer.setUniformMatrix(outlineProgID, "modelViewProjMatrix", MVPMatrix);

    var contextWidth = renderer.getContextWidth();
    var contextHeight = renderer.getContextHeight();

    for(var primSet = 0; primSet < geometry.getPrimitiveSets().length; primSet++)
    {
      var currColl = geometry.getPrimitiveSets()[primSet];

    // Prevent C3DL from reporting an error, so check if attrib exsits
    // before trying to set it.
    // This is  a kludge for Safari and Chrome since they want these attributes
    ////////////////////////////
    var normalAttribLoc = gl.getAttribLocation(outlineProgID,"Normal");
		if(normalAttribLoc != -1 && currColl.getNormals())
		{
      renderer.setVertexAttribArray(outlineProgID, "Normal", 3, currColl.getVBONormals());
		}
		var texAttribLoc = gl.getAttribLocation(outlineProgID, "Texture");
		if(texAttribLoc != -1 && currColl.getTexCoords())
		{
			renderer.setVertexAttribArray(outlineProgID, "Texture", 2, currColl.getVBOTexCoords());
		}
    ////////////////////////// End kludge
    
    
      renderer.setVertexAttribArray(outlineProgID, "Vertex", 3, currColl.getVBOVertices());        

      gl.viewport( 1,-1, contextWidth,contextHeight);          
      gl.drawArrays(renderer.getFillMode(), 0, currColl.getVertices().length/3);

      gl.viewport(-1,-1, contextWidth,contextHeight);          
      gl.drawArrays(renderer.getFillMode(), 0, currColl.getVertices().length/3);

      gl.viewport(-1, 1, contextWidth,contextHeight);          
      gl.drawArrays(renderer.getFillMode(), 0, currColl.getVertices().length/3);

      gl.viewport( 1, 1,contextWidth,contextHeight);
      gl.drawArrays(renderer.getFillMode(), 0, currColl.getVertices().length/3);
    }

    // restore normal backface culling
    gl.cullFace(gl.BACK);
    gl.viewport(0,0,contextWidth,contextHeight);

    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(0.0, 0.0);
    gl.useProgram(programObjID);
  }

  renderer.setUniformi(programObjID, "lightingOn", true);
  // render all the collation elements. Every collation element in an object will 
  // have the same tranformation
  for(var coll = 0; coll < geometry.getPrimitiveSets().length; coll++)
  {
    var currColl = geometry.getPrimitiveSets()[coll];

    var normalAttribLoc = gl.getAttribLocation(programObjID, "Normal");

    // if the object acutally has normals and the normal attribute was found
    // NORMALS	
    if(currColl.getNormals())
    {				
      // the top matrix is the modelview matrix.
      var NormalMatrix = c3dl.inverseMatrix(modelViewMatrix);
      NormalMatrix = c3dl.transposeMatrix(NormalMatrix);
      renderer.setUniformMatrix(programObjID, "normalMatrix", NormalMatrix);
      renderer.setVertexAttribArray(programObjID, "Normal", 3, currColl.getVBONormals());
    }
    else
    {
      gl.disableVertexAttribArray(normalAttribLoc);
    }

    // TEXTURE
    var texAttribLoc = gl.getAttribLocation(programObjID, "Texture");
    var texID = renderer.getTextureID(currColl.getTexture());

    // if the texture isn't loaded, but this collation element has one, 
    // queue one up
    if(texID == -1 && currColl.getTexture())
    {
      renderer.addTexture(currColl.getTexture());
    }

    if( texID != -1 && currColl.getTexture() && currColl.getTexCoords() && texAttribLoc != -1 )
    {
      // make texture unit 0 active
      gl.activeTexture(gl.TEXTURE0);

      // bind the collations texture object to texture unit 0 and make it active.
      gl.bindTexture(gl.TEXTURE_2D, texID);

      renderer.setVertexAttribArray(programObjID, "Texture", 2, currColl.getVBOTexCoords());

      renderer.setUniformi(programObjID, "myTex", 0);
      renderer.setUniformi(programObjID, "usingTexture", true);
    }
    else
    {
      gl.disableVertexAttribArray(texAttribLoc);
      renderer.setUniformi(programObjID, "usingTexture", false);
    }

    // Quantization Map
    var qMap = effect.getParameter("qMap");
    shadesTexID = renderer.getTextureID(qMap);

    // if the user added the parameter, but didn't add the texture
    // to the renderer with renderer.addTexture.
    if(shadesTexID == -1)
    {
      renderer.addTexture(qMap);
    }

    gl.activeTexture(gl.TEXTURE1);
 
    // Minefield is throwing an exception here, but still running?
    gl.bindTexture(gl.TEXTURE_2D, shadesTexID);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    renderer.setUniformi(programObjID, "celShadeTex", 1);

    // VERTICES
    renderer.setVertexAttribArray(programObjID, "Vertex", 3, currColl.getVBOVertices());
    gl.drawArrays(renderer.getFillMode(), 0, currColl.getVertices().length/3);
  }
}

var camera, scene, render, mesh, dae, particlelight;

var loader = new THREE.JSONLoader();
loader.load( 'mesh.json', function ( geometry ) {
    init();
    console.log(geometry);
    mesh = new THREE.Mesh(geometry, new THREE.MeshNormalMaterial({overdraw: true}));
    mesh.rotation.y -=Math.PI /2;
    mesh.position.y += 1;
    scene.add( mesh );
    animate();
});

function init() {

    renderer = new THREE.WebGLRenderer();

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(renderer.domElement);

    // FOV, Aspect, Near, Farh
    camera = new THREE.PerspectiveCamera(80, window.innerWidth/window.innerHeight, 1, 2000);
    // X, Y, Z
    camera.position.set(0,8,9);
    camera.rotation.x -= .7;


    scene = new THREE.Scene();
    // X, Y, Z axis
    var axisHelper = new THREE.AxisHelper( 500 );
    scene.add(axisHelper);

    var geometry = new THREE.BoxGeometry(200, 200, 200);
    var texture = THREE.ImageUtils.loadTexture('ac.gif');
    var material = new THREE.MeshBasicMaterial( {map: texture} );

    particlelight = new THREE.Mesh( new THREE.SphereGeometry(40, 80, 80), new THREE.MeshBasicMaterial( {color: 0xffffff }));
    particlelight.position.x = 300;
    scene.add(particlelight);

    var floorTex = new THREE.ImageUtils.loadTexture('checkerboard.jpg');
    floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;
    floorTex.repeat.set(10,10);
    var floorMat = new THREE.MeshBasicMaterial( {map: floorTex, side: THREE.DoubleSide} );
    var floorGem = new THREE.PlaneGeometry(100, 100);
    var floor = new THREE.Mesh(floorGem, floorMat);
    floor.rotation.x = -Math.PI /2;
    scene.add(floor);

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousewheel', onMouseWheel, false);
    window.addEventListener('keydown', onKeyDown, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseWheel(e) {
    if( e.wheelDelta > 0) {
        camera.position.z-=1;
        camera.position.y-=1;
    }
    else if(camera.position.z < 1000 && e.wheelDelta < 0) {
        camera.position.z+=1;
        camera.position.y+=1;
    }

    renderer.render(scene,camera);
}

function onKeyDown(e) {
    if( e.keyCode === 87) {
        camera.position.z-=.1;
        mesh.position.z -= .1;
    }
    else if(e.keyCode == 83) {
        camera.position.z+=.1;
        mesh.position.z += .1;
    }
    else if(e.keyCode == 65) {
        camera.position.x-=.1;
        //mesh.rotateX(.1);
        mesh.position.x-=.1;
        //mesh.rotation.y -= .01;
    }
    else if(e.keyCode == 68) {
        camera.position.x+=.1;
        mesh.position.x +=.1;
        //mesh.rotation.z += .01;
    }
    renderer.render(scene,camera);
}



function animate() {
    requestAnimationFrame( animate );

    //mesh.rotation.y += .02;
    //mesh.rotation.x += .01;

    renderer.render(scene,camera);
}

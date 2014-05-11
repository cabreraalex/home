var game = new Phaser.Game(600, 600, Phaser.AUTO, 'game', { preload: preload, create: create, update: update });

var redpawns = [12];
var bluepawns = [12];

var redgenerals = [2];
var bluegenerals = [2];

function preload(){
    game.load.image('grid', 'res/grid.png');
    game.load.image('redpiece', 'res/redpiece.png');
    game.load.image('bluepiece', 'res/bluepiece.png');
    game.load.image('bluegeneral', 'res/bluegeneral.png');
    game.load.image('redgeneral', 'res/redgeneral.png');
}

function create(){

    game.add.sprite(0, 0, 'grid');

    for (var i = 0; i < 8; i++){
        redpawns[i] = game.add.sprite(555, 0, 'redpiece');
        redpawns[i].inputEnabled = true;
        redpawns[i].input.enableDrag();
        redpawns[i].input.enableSnap(48, 48, false, true, 14, 14);
        redpawns[i].events.onDragStop.add(redFix);
        bluepawns[i] = game.add.sprite(0, 0, 'bluepiece');
        bluepawns[i].inputEnabled = true;
        bluepawns[i].input.enableDrag();
        bluepawns[i].input.enableSnap(48,48, false, true, 14, 14);
        bluepawns[i].events.onDragStop.add(blueFix);
    }

    for (var i = 0; i < 2; i++){
        redgenerals[i] = game.add.sprite(555, 45, 'redgeneral');
        redgenerals[i].inputEnabled = true;
        redgenerals[i].input.enableDrag();
        redgenerals[i].input.enableSnap(48, 48, false, true, 14, 14);
        redgenerals[i].events.onDragStop.add(redFix);
        bluegenerals[i] = game.add.sprite(0, 45, 'bluegeneral');
        bluegenerals[i].inputEnabled = true;
        bluegenerals[i].input.enableDrag();
        bluegenerals[i].input.enableSnap(48, 48, false, true, 14, 14);
        bluegenerals[i].events.onDragStop.add(blueFix);
    }
}


function update(){}

function blueFix(item) {
    if(item.x > 300) {
        item.x = 254;
    }
}

function redFix(item) {
    if(item.x < 300) {
        item.x = 300;
    }
}

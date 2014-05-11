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

    redpawns[0] = game.add.sprite(302, 254, 'redpiece');
    bluepawns[0] = game.add.sprite(254, 254, 'bluepiece');
    redgenerals[0] = game.add.sprite(542, 254, 'redgeneral');
    bluegenerals[0] = game.add.sprite(14, 254, 'bluegeneral');

    for (var i = 0; i < 1; i++){
        redpawns[i].inputEnabled = true;
        redpawns[i].input.enableDrag();
        bluepawns[i].inputEnabled = true;
        bluepawns[i].input.enableDrag();
    }

    for (var i = 0; i < 1; i++){
        redgenerals[i].inputEnabled = true;
        redgenerals[i].input.enableDrag();
        bluegenerals[i].inputEnabled = true;
        bluegenerals[i].input.enableDrag();
    }
}


function update(){}

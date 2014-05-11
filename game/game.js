var game = new Phaser.Game(600, 600, Phaser.AUTO, 'game', { preload: preload, create: create, update: update });

function preload(){
    game.load.image('grid', 'res/grid.png');
    game.load.image('redpiece', 'res/redpiece.png');
    game.load.image('bluepiece', 'res/bluepiece.png');
}

function create(){
    game.add.sprite(0, 0, 'grid');
    game.add.sprite(302, 254, 'redpiece');
    game.add.sprite(254, 254, 'bluepiece');
}


function update(){}

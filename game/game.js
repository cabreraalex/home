var game = new Phaser.Game(600, 600, Phaser.AUTO, 'game', { preload: preload, create: create, update: update });

function preload(){
    game.load.image('grid', 'res/grid.png');
}

function create(){
    game.add.sprite(0, 0, 'grid');
}


function update(){}

var game = new Phaser.Game(600, 600, Phaser.AUTO, 'game', { preload: preload, create: create, update: update, render: render });

var pieces = [16];
const BLOCK = 48;
var redmoves = 5;
var bluemoves = 5;
var bluecount;
var redcount;
var X;
var Y;

function preload(){
    game.load.image('grid', 'res/grid.png');
    game.load.image('redpiece', 'res/redpiece.png');
    game.load.image('bluepiece', 'res/bluepiece.png');
    game.load.image('bluegeneral', 'res/bluegeneral.png');
    game.load.image('redgeneral', 'res/redgeneral.png');
}

function create(){

    game.add.sprite(0, 0, 'grid');

    var style = { font: "22px Arial", fill: "white" };

    bluecount = game.add.text(14, 555, "Spaces: " + bluemoves, style);
    redcount  = game.add.text(490, 555, "Spaces: " + redmoves, style);



    for (var i = 0; i < 12; i += 2){
        pieces[i] = game.add.sprite(535,0,'redpiece');
        pieces[i].inputEnabled = true;
        pieces[i].input.enableDrag();
        pieces[i].input.enableSnap(BLOCK, BLOCK, false, true, 14, 14);
        pieces[i].events.onDragStop.add(redFix);
        pieces[i].events.onDragStart.add(getLoc);
        pieces[i]['color'] = 'red';
        pieces[i]['id'] = i;
        pieces[i+1] = game.add.sprite(0, 0, 'bluepiece');
        pieces[i+1].inputEnabled = true;
        pieces[i+1].input.enableDrag();
        pieces[i+1].input.enableSnap(48,48, false, true, 14, 14);
        pieces[i+1].events.onDragStop.add(blueFix);
        pieces[i+1].events.onDragStart.add(getLoc);
        pieces[i+1]['color'] = 'blue';
        pieces[i+1]['id'] = i+1;
    }

    for (var i = 12; i < 16; i+=2){
        pieces[i] = game.add.sprite(535, 45, 'redgeneral');
        pieces[i].inputEnabled = true;
        pieces[i].input.enableDrag();
        pieces[i].input.enableSnap(BLOCK, BLOCK, false, true, 14, 14);
        pieces[i].events.onDragStop.add(redFix);
        pieces[i]['color'] = 'red';
        pieces[i]['id'] = i;
        pieces[i].events.onDragStart.add(getLoc);
        pieces[i+1] = game.add.sprite(0, 45, 'bluegeneral');
        pieces[i+1].inputEnabled = true;
        pieces[i+1].input.enableDrag();
        pieces[i+1].input.enableSnap(48, 48, false, true, 14, 14);
        pieces[i+1].events.onDragStop.add(blueFix);
        pieces[i+1].events.onDragStart.add(getLoc);
        pieces[i+1]['color'] = 'blue';
        pieces[i+1]['id'] = i+1;
    }
}


function update(){

}

function render(){
}


function blueFix(item) {
    /*if(item.x > 300) {
        item.x = 254;
    }*/
    gridBounds(item);
    itemAction(item);
    bluemoves--;
    bluecount.setText("Spaces: " + (bluemoves) );
    if(bluemoves == 0){
        bluecount.setText("Done");
        bluemoves = 5;
    }
}

function redFix(item) {
    /*if(item.x < 300) {
        item.x = 300;
    }*/
    gridBounds(item);
    itemAction(item);
    redmoves--;
    redcount.setText("Spaces: " + (redmoves) );
    if(redmoves == 0){
        redcount.setText("Done");
        redmoves = 5;
    }
}

function gridBounds(item){

    if(item.x < 14){
        resetLoc(item);
    }
    if(item.x > 590) {
        resetLoc(item);
    }

    if(item.x < 60 || item.x > 530) {
        if(item.y < 254){
            resetLoc(item);
        }
        else if(item.y > 348) {
            resetLoc(item);
        }
    }

    else if(item.x < 109 || item.x > 492) {
        if(item.y > 445) {
            resetLoc(item);
        }
        else if(item.y < 155) {
            resetLoc(item);
        }
    }

    else if(item.x < 157 || item.x > 445){
        if(item.y < 108) {
            resetLoc(item);
        }
        else if(item.y > 492){
            resetLoc(item);
        }
    }

    else if(item.x < 252 || item.x > 348) {
        if(item.y < 60){
            resetLoc(item);
        }
        else if(item.y > 540){
            resetLoc(item);
        }
    }

    else {
        if(item.y < 14) {
            resetLoc(item);
        }
        else if(item.y > 588) {
            resetLoc(item);
        }
    }
}

function itemAction(item){
    for(w = 0; w < 16; w++){
        if(item.x == pieces[w]['x'] && item.y == pieces[w]['y'] && item['id'] != pieces[w]['id']){
            if(item['color'].localeCompare(pieces[w]['color'])){
                pieces[w].kill();
                pieces[w] = null;
            }
            else {
                item.x = X;
                item.y = Y;
            }
        }
    }
}

function getLoc(item){
    X = item.x;
    Y = item.y;
}

function resetLoc(item){
    item.x = X;
    item.y = Y;
}

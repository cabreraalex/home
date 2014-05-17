var game = new Phaser.Game(600, 600, Phaser.AUTO, 'game', { preload: preload, create: create, update: update });

var pieces = [16];
const BLOCK = 48;
var redmoves = 7;
var bluemoves = 7;
var bluecount;
var redcount;

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
        pieces[i] = game.add.sprite(555,0,'redpiece');
        pieces[i].inputEnabled = true;
        pieces[i].input.enableDrag();
        pieces[i].input.enableSnap(BLOCK, BLOCK, false, true, 14, 14);
        pieces[i].events.onDragStop.add(redFix);
        pieces[i]['color'] = 'red';
        pieces[i]['id'] = i;
        pieces[i+1] = game.add.sprite(0, 0, 'bluepiece');
        pieces[i+1].inputEnabled = true;
        pieces[i+1].input.enableDrag();
        pieces[i+1].input.enableSnap(48,48, false, true, 14, 14);
        pieces[i+1].events.onDragStop.add(blueFix);
        pieces[i+1]['color'] = 'blue';
        pieces[i+1]['id'] = i+1;
    }

    for (var i = 12; i < 16; i+=2){
        pieces[i] = game.add.sprite(555, 45, 'redgeneral');
        pieces[i].inputEnabled = true;
        pieces[i].input.enableDrag();
        pieces[i].input.enableSnap(BLOCK, BLOCK, false, true, 14, 14);
        pieces[i].events.onDragStop.add(redFix);
        pieces[i]['color'] = 'red';
        pieces[i]['id'] = i;
        pieces[i+1] = game.add.sprite(0, 45, 'bluegeneral');
        pieces[i+1].inputEnabled = true;
        pieces[i+1].input.enableDrag();
        pieces[i+1].input.enableSnap(48, 48, false, true, 14, 14);
        pieces[i+1].events.onDragStop.add(blueFix);
        pieces[i+1]['color'] = 'blue';
        pieces[i+1]['id'] = i+1;
    }
}


function update(){
    if(game.input.onDown) {
        console.log("i");
    }
}


function blueFix(item) {
    /*if(item.x > 300) {
        item.x = 254;
    }*/
    gridBounds(item);
    itemAction(item);
    bluecount.setText("Spaces: " + (bluemoves - 1) );
}

function redFix(item) {
    /*if(item.x < 300) {
        item.x = 300;
    }*/
    gridBounds(item);
    itemAction(item);
    redcount.setText("Spaces: " + (redmoves - 1) );
}

function gridBounds(item){

    if(item.x < 0){
        item.x = 14;
    }
    if(item.x > 550) {
        item.x = 542;
    }

    if(item.x < 60 || item.x > 500) {
        if(item.y < 300){
            item.y = 254;
        }
        else {
            item.y = 301;
        }
    }

    else if(item.x < 100 || item.x > 450) {
        if(item.y < 150) {
            item.y = 158;
        }
        else if(item.y > 380) {
            item.y = 400;
        }
    }

    else if(item.x < 150 || item.x > 400){
        if(item.y < 100) {
            item.y = 110;
        }
        else if(item.y > 425){
            item.y = 446;
        }
    }

    else if(item.x < 225 || item.x > 325) {
        if(item.y < 100){
            item.y = 61;
        }
        else if(item.y > 450){
            item.y = 494;
        }
    }

    else {
        if(item.y < 14) {
            item.y = 14;
        }
        else if(item.y > 586) {
            item.y = 542;
        }
    }
}

function itemAction(item){
    for(w = 0; w < 16; w++){
        if(item.x == pieces[w]['x'] && item.y == pieces[w]['y'] && item['id'] != pieces[w]['id']){
            if(item['color'].localeCompare(pieces[w]['color'])){
                pieces[w].kill();
            }
            else {
                if(item.y > 300){
                    item.y = item.y - BLOCK;
                }
                else {
                    item.y = item.y + BLOCK;
                }
            }
        }
    }
}

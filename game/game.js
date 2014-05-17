var game = new Phaser.Game(600, 600, Phaser.AUTO, 'game', { preload: preload, create: create, update: update });

var pieces = [14];
const BLOCK = 48;


function preload(){
    game.load.image('grid', 'res/grid.png');
    game.load.image('redpiece', 'res/redpiece.png');
    game.load.image('bluepiece', 'res/bluepiece.png');
    game.load.image('bluegeneral', 'res/bluegeneral.png');
    game.load.image('redgeneral', 'res/redgeneral.png');
}

function create(){

    game.add.sprite(0, 0, 'grid');

    for (var i = 0; i < 5; i += 2){
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

    for (var i = 5; i < 10; i+=2){
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

}


function blueFix(item) {
    /*if(item.x > 300) {
        item.x = 254;
    }*/
    gridBounds(item);
    itemAction(item);
}

function redFix(item) {
    /*if(item.x < 300) {
        item.x = 300;
    }*/
    gridBounds(item);
    itemAction(item);
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

    else if(item.x < 100 || item.x > 480) {
        if(item.y < 100) {
            item.y = 158;
        }
        else if(item.y > 400) {
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
    for(w = 0; w < 20; w++){
        if(item.x == pieces[w]['x'] && item.y == pieces[w]['y'] && item['id'] != pieces[w]['id']){
            if(item['color'].localeCompare(pieces[w]['color'])){
                pieces[w].kill();
                console.log("lol");
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

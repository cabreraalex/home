var game = new Phaser.Game(600, 600, Phaser.AUTO, 'game', { preload: preload, create: create, update: update});

const BLOCK = 48;

var pieces = [16];

var redspaces = 5;
var bluespaces = 5;

var bluecount;
var redcount;

var X;
var Y;

var pregameBlue = true;
var pregameRed = true;
var pregame = true;

var foreground;
var startbutton;
var title;

function preload(){
    game.load.image('grid', 'res/grid.png');
    game.load.image('redpiece', 'res/redpiece.png');
    game.load.image('bluepiece', 'res/bluepiece.png');
    game.load.image('bluegeneral', 'res/bluegeneral.png');
    game.load.image('redgeneral', 'res/redgeneral.png');
    game.load.image('startback', 'res/startback.png');
    game.load.image('title', 'res/title.png');
    game.load.spritesheet('startbutton', 'res/start.png', 250, 75, 2);
    game.load.spritesheet('resumebutton', 'res/resume.png', 250, 75, 2);
    game.load.spritesheet('nextbutton', 'res/button.png', 90, 30, 2);
}

function create(){

    game.add.sprite(0, 0, 'grid');

    var style = { font: "22px Arial", fill: "white" };

    bluecount = game.add.text(14, 555, "Spaces: " + bluespaces, style);
    redcount  = game.add.text(490, 555, "Spaces: " + redspaces, style);

    bluebutton = game.add.button(20, 520, 'nextbutton', buttonClickBlue, this, 1, 0);
    redbutton = game.add.button(500, 520, 'nextbutton', buttonClickRed, this, 1, 0);

    for (var i = 0; i < 12; i += 2){
        pieces[i] = game.add.sprite(535,0,'redpiece');
        pieces[i].inputEnabled = true;
        pieces[i].input.enableDrag();
        pieces[i].input.enableSnap(BLOCK, BLOCK, false, true, 14, 14);
        pieces[i].events.onDragStop.add(redFix);
        pieces[i].events.onDragStart.add(getLoc);
        pieces[i]['color'] = 'red';
        pieces[i]['id'] = i;
        pieces[i]['type'] = 'pawn';
        pieces[i+1] = game.add.sprite(14, 0, 'bluepiece');
        pieces[i+1].inputEnabled = true;
        pieces[i+1].input.enableDrag();
        pieces[i+1].input.enableSnap(48,48, false, true, 14, 14);
        pieces[i+1].events.onDragStop.add(blueFix);
        pieces[i+1].events.onDragStart.add(getLoc);
        pieces[i+1]['color'] = 'blue';
        pieces[i+1]['id'] = i+1;
        pieces[i+1]['type'] = 'pawn';
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
        pieces[i]['type'] = 'general';
        pieces[i+1] = game.add.sprite(14, 45, 'bluegeneral');
        pieces[i+1].inputEnabled = true;
        pieces[i+1].input.enableDrag();
        pieces[i+1].input.enableSnap(48, 48, false, true, 14, 14);
        pieces[i+1].events.onDragStop.add(blueFix);
        pieces[i+1].events.onDragStart.add(getLoc);
        pieces[i+1]['color'] = 'blue';
        pieces[i+1]['id'] = i+1;
        pieces[i+1]['type'] = 'general';
    }

    foreground = game.add.sprite(0,0,'startback');
    foreground.inputEnabled = true;
    start = game.add.sprite(120,130,'title');
    startbutton = game.add.button(175, 342.5, 'startbutton', buttonClickStart, this, 1, 0);
}

function update() {
    if(game.input.keyboard.isDown(Phaser.Keyboard.ESC)){
        if(foreground.exists){

        }
        else{
            foreground = game.add.image(0,0,'startback');
            foreground.inputEnabled = true;
            startbutton = game.add.button(175, 262.5, 'resumebutton', buttonClickStart, this, 1, 0);
            start = game.add.sprite(120,40,'title');
        }
    }
}

function blueFix(item) {
    /*if(item.x > 300) {
        item.x = 254;
    }*/
    gridBounds(item);
    itemAction(item);
    x = 0;
    if(!pregameBlue){
        x = calcDistance(item.x, item.y);
    }
    bluespaces -= x;
    bluecount.setText("Spaces: " + (bluespaces) );
    if(bluespaces == 0){
        bluecount.setText("Done");
        redcount.setText("Spaces: " + (redspaces));
        bluespaces = 5;
    }
}

function redFix(item) {
    /*if(item.x < 300) {
        item.x = 300;
    }*/
    gridBounds(item);
    itemAction(item);
    x = 0;
    if(!pregameRed){
        x = calcDistance(item.x, item.y);
    }
    redspaces -= x;
    redcount.setText("Spaces: " + (redspaces) );
    if(redspaces == 0){
        redcount.setText("Done");
        bluecount.setText("Spaces: " + (bluespaces));
        redspaces = 5;
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

    if(item['type'].localeCompare('pawn') == 0 && !pregame){
        if((Math.abs(item.y - Y) > 20) && Math.abs(item.x - X) > 20){
            resetLoc(item);
        }
    }

    /*
    else if(item['type'].localeCompare('general') == 0 && !pregame){
        distance = (Math.sqrt(Math.pow(Math.abs(item.y - Y), 2)) + (Math.pow(Math.abs(item.x -X, 2))));
        if(Math.abs(item.y - Y) > 20 && Math.abs(item.x - X)){
            resetLoc(item);
        }
    }
    */
}

function itemAction(item){
    for(w = 0; w < 16; w++){
        if(item.x == pieces[w]['x'] && item.y == pieces[w]['y'] && item['id'] != pieces[w]['id']){
            if(item['color'].localeCompare(pieces[w]['color']) != 0){
                pieces[w].kill();
                pieces[w] = 0;
            }
            else {
                resetLoc(item);
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

function calcDistance(x, y){
    if(Math.abs(y-Y) > Math.abs(x-X)){
        return Math.abs((y-Y)/48);
    }
    else if(Math.abs(y-Y) < Math.abs(x-X)){
        return Math.abs((x-X)/48);
    }
    else{
        return Math.abs((x-X)/48);
    }
}

function buttonClickRed(){
    pregameRed = !pregameRed;
}

function buttonClickBlue(){
    pregameBlue = !pregameBlue;
}

function buttonClickStart(){
    foreground.destroy();
    startbutton.destroy();
    start.destroy();
}

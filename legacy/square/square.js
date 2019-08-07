var canvas = document.getElementById("canvas");
var context = canvas.getContext("2d");

canvas.height = 500;
canvas.width = 500;

var wheight = canvas.height;
var wwidth = canvas.width;

context.beginPath();
context.rect(0, 0, wwidth, wheight);
context.fillStyle = '#000000';
context.fill();

var side = 500;
var iter = 0;
var rgb = [255, 255, 255, 2];

var points = [];
points.push([wwidth/2, wheight/2, side]);

function drawRect(point, side) {
  context.beginPath();
  context.rect(point[0]-side/2, point[1] - side/2, side, side);
  context.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] +')';
  context.fill();
}

function addQueue(point, side){
  points.push([point[0]-side/2,point[1]-side/2,side]);
  points.push([point[0]-side/2,point[1]+side/2,side]);
  points.push([point[0]+side/2,point[1]-side/2,side]);
  points.push([point[0]+side/2,point[1]+side/2,side]);
}

function expand(point, side){
  side = side/2;

  drawRect(point,side);

  point[0] = point[0] - side/2;
  point[1] = point[1] - side/2;
  side = side/2;
  drawRect(point, side);
  addQueue(point, side);

  point[1] = side*2 + point[1];
  drawRect(point,side);
  addQueue(point, side);

  point[0] = side*2 + point[0];
  drawRect(point,side);
  addQueue(point, side);

  point[1] = -side*2 + point[1];
  drawRect(point,side);
  addQueue(point, side);
}

function square(iter){
  context.beginPath();
  context.rect(0, 0, wwidth, wheight);
  context.fillStyle = '#000000';
  context.fill();
  var x = 0;
  while(x != iter) {
    expand(points[x], points[x][2]);
    points.slice(1);
    x++;
  }
  points = [];
  rgb = [255, 255, 255, 2];
  points.push([wwidth/2, wheight/2, side]);
}

square(10);

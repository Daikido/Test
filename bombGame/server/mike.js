var arr1 = [];
for (var i = 0; i < 10; i++) {
    var arr2 = [];
    for (var j = 0; j < 10; j++) {
        arr2.push(j);
    }
    arr1.push(arr2);
}

var set = function (x, y, data) {
    arr1[x][y] = data;
}
var get = function (x, y) {
    return arr1[x][y];
}
var number=0;
var time=0;
exports.update=function(t){
    var delta = t-time;
    time = t;
}
exports.click = function(n){
    number+=n;
}

exports.getNumber = function(){
    return number;
}
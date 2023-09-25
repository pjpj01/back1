const express = require('express');
const http = require('http');
const serveStatic = require('serve-static');      //특정 폴더의 파일들을 특정 패스로 접근할 수 있도록 열어주는 역할
const path = require('path');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2');
const expressSession = require('express-session');
const mysqlSession = require('express-mysql-session')(expressSession);
var app = express();      //express 서버 객체
const socketIo = require('socket.io');
let bodyParser_post = require('body-parser');       //post 방식 파서
const reservation = require('./server.js');
var usId;

//db로 실험 - 성공
const db2 = mysql.createConnection({
  host : 'localhost',
  port : 3306,
  user : 'root',
  password : '1234',
  database : 'authtest'
})
db2.connect();

router.route('/process/reserve').get(
  function(req, res) {
    console.log('/process/reserve 라우팅 함수호출 됨');
    res.redirect('/reserve.html')
    usId = reservation.getReservationInfo(req);
  }
);

module.exports = (io) => {
    // Socket.IO 이벤트 리스너 등록 -> 웹소켓 연결 시
    io.on('connection', (socket) => {
      console.log('A user connected');
      let infonum;
      var info;
      
      // 예약 관련 소켓 이벤트 처리 -> 이벤트 이름을 makeReservation으로 해야 응답을 받을 수 있음
      socket.on('makeReservationfirst', (data) => {//data에는 클라이언트에서 서버로 전송된 데이터가 들어감
        // 예약을 처리하고 클라이언트에 응답을 보낼 수 있음 - 12345말고 다른거 되게 해야함 변수로 - 세션 정보 활용
        info = [data[0],data[1],data[2],data[3],data[4]]
        db2.query('SELECT * FROM users WHERE userid = ?', usId, function(err, row) {//userid로 번호를 찾아서 -> 세션정보에 번호를 담을까
          if(err) {
              console.log(err);
          }    
          if(row.length > 0) {
            
            infonum = row[0].phone_num; 
            db2.query(`INSERT INTO reserve(phone_num, year, month, date, space${data[4]}) VALUE(?,?,?,?,?)`//그 id의 전화번호를 근거로 예약
            , info, function(err, row) {
                if(err) {
                    console.log(err);
                }    
                else {
                  db2.query('SELECT * FROM reserve WHERE phone_num = ?', infonum, function(err, row) {//클라이언트쪽으로 넘길 자료 
                    if(err) {                                                                         //-> 예약 대기 상황이므로 잘 판단하기
                        console.log(err);
                    }    
                    if(row.length > 0) {
                      // io.emit() 또는 socket.emit()을 사용하여 클라이언트에 데이터를 보낼 수 있음 -io가 모두, socket이 특정
                      io.emit('customEvent', row[0]); //클라이언트에서도 이벤트이름 : customEvent
                      
                    }
                  }); 
                }
            }); 
        
          }
        });  
        
 
        
      });
      socket.on('cancelReserve', (data) => {//클라이언트쪽에서 자료 넘어오면 근거로 db에서 없애고 클라이언트에 반환
        
      });
      socket.on('approveReserve', (data) => {//클라이언트쪽에서 관리자의 승인이 넘어오면 db를 갱신하고 클라이언트에 반환
        
      });
      // 다른 소켓 이벤트 처리 - makeReservation말고 여러개 만들수 있음
      
      //웹소켓 연결 종료 시
      socket.on('disconnect', () => {
        console.log('A user disconnected');
      });
    });
  };

  //이제 해야할 것 이벤트를 3가지로 분류 - 예약(대기), 취소, 승인 -> 각각마다 socket.on으로 케이스 분류해서 프로그래밍 예정
var app = angular.module('partyVote', ['rzModule', 'ui.bootstrap', 'matchMedia']);

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

/**
  Rules - http://law.moj.gov.tw/LawClass/LawSingle.aspx?Pcode=D0020010&FLNO=67

  1)以各政黨得票數相加之和，除各該政黨得票數，求得各該政黨得票比率。
  2)以應選名額乘前款得票比率所得積數之整數，即為各政黨分配之當選名額；按政黨名單順位依序當選。
  3)依前款規定分配當選名額後，如有剩餘名額，應按各政黨分配當選名額後之剩餘數大小，依序分配剩餘名額。剩餘數相同時，以抽籤決定之。
  4)政黨登記之候選人名單人數少於應分配之當選名額時，視同缺額。
  5)各該政黨之得票比率未達百分之五以上者，不予分配當選名額；其得票數不列入第一款計算。
  6)第一款至第三款及前款小數點均算至小數點第四位，第五位以下四捨五入。

  @param {Number} totalSeat - total number of seats
  @param {Number[]} threshold - threshold. 5 means 5%.
  @param {Number[]} partyValues - list of raw percentage of each party. 32 means 32%.
  @return {Object()} List of {value, seats}
*/
function calculateSeats(totalSeat, threshold, stage1votes) {
  // Apply rule 5 & rule 1
  //
  var stage1sum = stage1votes.reduce(function(s, p){
    return s + (p >= threshold ? p : 0)
  }, 0);

  var stage2votes = stage1votes.map(function(p){
    return p >= threshold ? +(p * 100 / stage1sum).toFixed(2) : 0
  });

  // Apply rule 2
  //
  var stage2totalSeat = 0
  var partiesData = stage2votes.map(function(p, idx){
    var seat = totalSeat * p / 100, flooredSeat = Math.floor(seat);

    stage2totalSeat += flooredSeat;

    return {
      id: idx, // partiesData will be sorted later, thus requires idx
      seat: flooredSeat,
      remain: seat - flooredSeat
    }
  })

  var result = stage2votes.map(function(p, idx){
    return {
      stage1votes: stage1votes[idx],
      value: p,
      seat: partiesData[idx].seat
    }
  });

  // Apply rule 3
  //
  shuffle(partiesData).sort(function(a, b){return b.remain-a.remain})
  while(stage2totalSeat < totalSeat) {
    var partyData = partiesData.shift();
    result[partyData.id].seat += 1;
    stage2totalSeat += 1;
  }

  return result;
}

/**
  Rules -
  https://zh.wikipedia.org/wiki/%E8%81%94%E7%AB%8B%E5%88%B6
  https://en.wikipedia.org/wiki/Mixed-member_proportional_representation

  1)各政黨總當選名額，以全國總應選名額依各政黨在第二張投政黨名單的得票比率分配。（假設使用與目前不分區算法相同的最大餘數法）
  2)扣除該黨在選舉區已得議席
  3)其差額再由政黨比例代表名額中補足。

  @param {Number} totalSeat - 總席次數量，正整數。
  @param {Number} threshold - 小黨門檻（5 代表 5%）。程式本身沒有檢查說加起來要 = 100%，未滿 100% 的部分，視同未過門檻的小黨們的和。
  @param {Number[]} partyVotePercentages - 各黨政黨票（不分區）得票率百分比（34 表示 34%）
  @param {Number[]} localSeats - 各黨區域立委席次
  @return {Object()} list of seats - 各黨總席次
*/
function calculateSeatsMMP(totalSeat, threshold, partyVotePercentages, localSeats) {
  return calculateSeats(totalSeat, threshold, partyVotePercentages).map(function(party, idx){
    return Math.max(party.seat /* expected seats */, localSeats[idx])
  })
}

function updateSliderStyle(parties, vertical) {
  parties.forEach(function(party) {
    party.options.vertical = vertical;
  });
}

app.controller('MainCtrl', function ($scope, $http, screenSize) {
  var totalSeats = 34;
  var queryString = {};
  var parties = [
    {no: 0, id: 'remain', name: '未分配比例'},
    {
      no: 1, id: 'dpp', name: '民主進步黨', enabled: true, partyno: "016"},
    {
      no: 2, id: 'pfp', name: '親民黨', enabled: true, partyno: "090"
    },
    {
      no: 3, id: 'ftp', name: '自由台灣黨', partyno: "272"
    },
    {
      no: 4, id: 'ppup', name: '和平鴿聯盟黨', partyno: "266"
    },
    {
      no: 5, id: 'mcfap', name: '軍公教聯盟黨', partyno: "258"
    },
    {
      no: 6, id: 'mkt', name: '民國黨', partyno: "268"
    },
    {
      no: 7, id: 'fhl', name: '信心希望聯盟', partyno: "283"
    },
    {
      no: 8, id: 'up', name: '中華統一促進黨', partyno: "113"
    },
    {
      no: 9, id: 'kmt', name: '中國國民黨', enabled: true, partyno: "001"
    },
    {
      no: 10, id: 'tsu', name: '台灣團結聯盟', partyno: "095",
    },
    {
      no: 11, id: 'npp', name: '時代力量', enabled: true, partyno: "267"
    },
    {
      no: 12, id: 'cct', name: '大愛憲改聯盟', partyno: "134"
    },
    {
      no: 13, id: 'sdp', name: '綠黨與社民黨聯盟', enabled: true, partyno: "281"
    },
    {
      no: 14, id: 'ti', name: '台灣獨立黨', partyno: "273"
    },
    {
      no: 15, id: 'npsu', name: '無黨團結聯盟', partyno: "106"
    },
    {
      no: 16, id: 'np', name: '新黨', partyno: "074"
    },
    {
      no: 17, id: 'nhsa', name: '健保免費連線', partyno: "189"
    },
    {
      no: 18, id: 'tp', name: '樹黨', partyno: "259"
    }
  ];
  $scope.parties = {};
  $scope.showVideo = false;

  $scope.desktop = screenSize.is('md, lg');
  $scope.mobile = screenSize.is('xs, sm');

  location.search.split('&').forEach(function(item) {
    item = /(\w+)=([\d\.]+)/gi.exec(item);
    if (item) queryString[item[1]] = parseFloat(item[2]) || 0;
  });

  // Using dynamic method `on`, which will set the variables initially and then update the variable on window resize
  screenSize.on('md, lg', function(match){
    $scope.desktop = match;
    updateSliderStyle(parties, $scope.desktop);
  });
  screenSize.on('xs, sm', function(match){
    $scope.mobile = match;
    updateSliderStyle(parties, $scope.desktop);
  });

  $scope.noRemain = false;
  $scope.$watch('noRemain', function() {
    update();
  });

  function update(id) {
    id = this.id || id;
    var party = $scope.parties[id];
    var total = 0.0;
    parties.forEach(function(party) {
      if (party.id !== 'remain') {
        total +=  parseFloat(party.value);
      }
    });
    $scope.parties.remain.value = (100 - total).toFixed(2);

    if ($scope.parties.remain.value < 0) {
      party.value = parseFloat(party.value) + parseFloat($scope.parties.remain.value);
      $scope.parties.remain.value = 0;
    }

    var greaterThanZero = parties.filter(function(party) {
      return parseFloat(party.value) > 0 && party.id !== 'remain';
    }).length;

    var calculated = calculateSeats(totalSeats, 5, parties.map(function(p) {
      var val = parseFloat(p.value);
      if ($scope.noRemain && p.id === 'remain') {
        return 0;
      }
      else if ($scope.noRemain && val > 0 && p.id !== 'remain') {
        return val / ( (100 - parseFloat($scope.parties['remain'].value) ) / 100 );
      }
      else {
        return parseFloat(p.value);
      }
    }));
    calculated.forEach(function(data, idx){
      parties[idx].stage1Value = data.stage1votes.toFixed(2)
      parties[idx].advancedValue = data.value
      parties[idx].seats = data.seat
    });

    parties.forEach(function(party) {
      party.candidates.forEach(function(c) {
        c.win = false;
      });

      var seats = party.seats > party.candidates.length ?
                  party.candidates.length : party.seats;

      var remainSeats = seats - Math.ceil(seats / 2);
      var females = party.candidates.filter(function(c) {
        return c.gender === 'F';
      });

      females.forEach(function(c, index) {
        c.win = index < Math.ceil(seats / 2);
      });

      party.candidates.forEach(function(c) {
        if (remainSeats > 0 && !c.win) {
          c.win = true;
          remainSeats--;
        }
      });
    });

    if (party) {
      if (party.value > 0) queryString[id] = (parseFloat(party.value) || 0).toFixed(2);
      else delete queryString[id];
      history.replaceState({}, '政黨票計算機', '?'+Object.keys(queryString).map(function(key){ return key + '=' + queryString[key]}).join('&'));
    }
  }

  parties.forEach(function(party) {
    $scope.parties[party.id] = party;
    party.candidates = [];
    party.value = party.id === 'remain' ? 100 : 0;
    party.seats = party.id === 'remain' ? totalSeats : 0;
    party.advancedValue = party.id === 'remain' ? 100 : 0;
    party.options = {
      id: party.id,
      ceil: 100,
      precision: 1,
      step: 0.1,
      vertical: $scope.desktop,
      readOnly: party.id === 'remain',
      disabled: party.id === 'remain',
      onChange: update,
      onEnd: update
    };
    if (Object.keys(queryString).length) {
      if (queryString[party.id]) {
        party.enabled = true
        party.value = queryString[party.id];
      } else {
        party.enabled = false
      }
    }
  });

  $scope.toggle = function(party) {
    party.enabled = !party.enabled;
    party.value = 0;
    party.seats = 0;
    party.advancedValue = 0;
    delete queryString[party.id];
    history.replaceState({}, '政黨票計算機', '?'+Object.keys(queryString).map(function(key){ return key + '=' + queryString[key]}).join('&'));
    update();
  };

  $http.get('candidates.json').then(function(res) {
    $scope.candidates = res.data['全國不分區及僑居國外國民立委公報'];
    $scope.candidates.sort(function(a, b) {
      return a.nosequence - b.nosequence;
    });

    $scope.candidates.forEach(function(candidate) {
      var no = parseInt(candidate.drawno);
      parties[no].candidates.push(candidate);
    });

    update();
  });

  updateSliderStyle(parties, $scope.desktop);
  $scope.update = update;
});

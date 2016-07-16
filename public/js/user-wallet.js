var walletMode = 1; // 1 active event list; 2 show cash flow

$('#wallet-mode-btn').on('click', function(e) {
  if(walletMode == 1) {
    walletMode = 2;
    $('#wallet-mode-btn').text('活动');
    $('#activeEventList').hide();
    $('#cashFlowList').show();
  } else {
    walletMode = 1;
    $('#wallet-mode-btn').text('明细');
    $('#activeEventList').show();
    $('#cashFlowList').hide();
  }
});

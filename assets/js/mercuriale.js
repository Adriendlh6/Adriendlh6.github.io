/* Mercuriale page module - phase 1 isolation */
(function(){
  window.MercurialePage = {
    render(){
      if (typeof renderMercuriale !== 'function') {
        console.error('renderMercuriale est indisponible');
        return;
      }
      return renderMercuriale();
    }
  };
})();

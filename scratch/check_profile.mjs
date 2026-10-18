async function check() {
  const r = await fetch('http://localhost:3000/influencer/CR1');
  const text = await r.text();
  console.log('contains 404:', text.includes('404'));
  console.log('contains Aarav:', text.includes('Aarav'));
  const h1Match = text.match(/<h1[^>]*>([^<]+)<\/h1>/);
  console.log('h1:', h1Match ? h1Match[1] : 'no h1');
}
check();

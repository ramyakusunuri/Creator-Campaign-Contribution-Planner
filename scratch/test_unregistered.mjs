async function test() {
  const res = await fetch('http://localhost:3000/api/brands/B1/unregistered-uses', {
    headers: { 'X-Brand-Key': 'b1_secret_key' }
  });
  const data = await res.json();
  console.log('Data:', data);
}
test();

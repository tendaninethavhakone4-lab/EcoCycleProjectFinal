const supabase = require('./supabase');

async function testConnection() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }

  console.log(data);
}

testConnection();
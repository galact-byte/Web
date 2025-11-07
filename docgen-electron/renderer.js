const generateButton = document.getElementById('generateButton');

generateButton.addEventListener('click', () => {
  const projectName = document.getElementById('projectName').value;
  console.log('项目名称:', projectName);
  
  // 你可以在这里调用后端服务（Python）来生成文档
  fetch('http://127.0.0.1:5000/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ projectName })
  })
  .then(response => response.json())
  .then(data => {
    console.log('文档生成成功:', data);
    alert('文档生成成功: ' + data.file);
  })
  .catch(error => {
    console.error('Error:', error);
  });
});


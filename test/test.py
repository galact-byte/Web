import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, rc):
    print("连接状态码：", rc)

client = mqtt.Client()  # 无用户名无密码 = 匿名
client.on_connect = on_connect

client.connect("xdzh.tyxd.gov.cn", 1883, 60)
client.loop_start()

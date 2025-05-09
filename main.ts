/*
Copyright (C): 2021-2025, yulin Blue Origin
modified from liusen
load dependency
"SuperBitV4": "file:../pxt-SuperBitV4"
*/

//% color="#ECA40D" weight=30 icon="\uf135"
namespace SuperBitV4 {

    const PCA9635_ADD = 0x70
    const MODE1 = 0x00
    const MODE2 = 0x01
    const SUBADR1 = 0x02
    const SUBADR2 = 0x03
    const SUBADR3 = 0x04

    const LED0_ON_L = 0x06
    const LED0_ON_H = 0x07
    const LED0_OFF_L = 0x08
    const LED0_OFF_H = 0x09

    const ALL_LED_ON_L = 0xFA
    const ALL_LED_ON_H = 0xFB
    const ALL_LED_OFF_L = 0xFC
    const ALL_LED_OFF_H = 0xFD

    const PRESCALE = 0xFE

    const STP_CHA_L = 127
    const STP_CHA_H = 255

    const STP_CHB_L = 1
    const STP_CHB_H = 128

    const STP_CHC_L = 63
    const STP_CHC_H = 191

    const STP_CHD_L = 191
    const STP_CHD_H = 127

    let initialized = false
    let yahStrip: neopixel.Strip;

   
    export enum enMusic {

        dadadum = 0,
        entertainer,
        prelude,
        ode,
        nyan,
        ringtone,
        funk,
        blues,

        birthday,
        wedding,
        funereal,
        punchline,
        baddy,
        chase,
        ba_ding,
        wawawawaa,
        jump_up,
        jump_down,
        power_up,
        power_down
    }
    

    
    export enum enSteppers {
        B1 = 0x1,
        B2 = 0x2
    }
    export enum enPos { 
        //% blockId="forward" block="forward"
        forward = 1,
        //% blockId="reverse" block="reverse"
        reverse = 2,
        //% blockId="stop" block="stop"
        stop = 3
    }

    export enum enTurns {
        //% blockId="T1B4" block="1/4"
        T1B4 = 90,
        //% blockId="T1B2" block="1/2"
        T1B2 = 180,
        //% blockId="T1B0" block="1"
        T1B0 = 360,
        //% blockId="T2B0" block="2"
        T2B0 = 720,
        //% blockId="T3B0" block="3"
        T3B0 = 1080,
        //% blockId="T4B0" block="4"
        T4B0 = 1440,
        //% blockId="T5B0" block="5"
        T5B0 = 1800
    }
    
    export enum enServo {
        
        S1 = 0,
        S2,
        S3,
        S4,
        S5,
        S6,
        S7,
        S8
    }
    /**
     * 直流电机选择枚举
     */
    export enum enMotors {
        M1 = 14,
        M2 = 16,
        M3 = 18,
        M4 = 20
    }
    /**
    * 向指定的 I2C 地址和寄存器写入一个字节的数据
     * @param addr I2C 设备地址
     * @param reg 寄存器地址
     * @param value 要写入的字节数据
     */
    function i2cwrite(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2)
        buf[0] = reg
        buf[1] = value
        pins.i2cWriteBuffer(addr, buf)
    }

    /**
     * 向指定的 I2C 地址写入一个字节的命令
     * @param addr I2C 设备地址
     * @param value 要写入的字节数据
     */
    function i2ccmd(addr: number, value: number) {
        let buf = pins.createBuffer(1)
        buf[0] = value
        pins.i2cWriteBuffer(addr, buf)
    }
    
    /**
     * 从指定的 I2C 地址和寄存器读取一个字节的数据
     * @param addr I2C 设备地址
     * @param reg 寄存器地址
     * @returns 读取到的字节数据
     */
    
    function i2cread(addr: number, reg: number) {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE);
        let val = pins.i2cReadNumber(addr, NumberFormat.UInt8BE);
        return val;
    }
    /**
     * 初始化 PCA9635 芯片
     */
    function initPCA9635(): void {
        // 设置 MODE1 寄存器为 0x00，启用正常模式
        i2cwrite(PCA9635_ADD, MODE1, 0x00)     //由0x00
        // 设置 PWM 频率为 24Hz，适用于舵机控制
        setFreq(24);
        // 标记为已初始化
        initialized = true
    }
    
    /**
     * 设置 PWM 频率
     * @param freq PWM 频率 (Hz)
     */
    function setFreq(freq: number): void {
        // Constrain the frequency
        // 约束频率范围
        let prescaleval = 25000000;   // 内部时钟频率
//        prescaleval /= 4096;           // 固定的分频系数
//        prescaleval /= freq;
//        prescaleval -= 1;
        prescaleval = 254;    //因为无法除整
        let prescale = prescaleval;     //Math.Floor(prescaleval + 0.5);
        let oldmode = i2cread(PCA9635_ADD, MODE1);
        // 进入睡眠模式以设置预分频器
        let newmode = (oldmode & 0x7F) | 0x10;   // sleep    
        i2cwrite(PCA9635_ADD, MODE1, newmode);   // go to sleep
        // 设置预分频器的值
        i2cwrite(PCA9635_ADD, PRESCALE, prescale); // set the prescaler
        // 恢复原来的模式
        i2cwrite(PCA9635_ADD, MODE1, oldmode);
        control.waitMicros(5000);
        // 启用自动递增模式
        i2cwrite(PCA9635_ADD, MODE1, oldmode | 0xa1);
    }
    
    /**
     * 设置指定通道的 PWM 输出
     * @param channel PWM 通道 (0-15)
     * @param on PWM 开启时的计数值 (0-4095)
     * @param off PWM 关闭时的计数值 (0-4095)
     */
    function setPwm(channel: number, on: number, off: number): void {
        // 检查通道是否有效
        if (channel < 0 || channel > 15)
            return;
        // 如果未初始化，则先进行初始化
        if (!initialized) {
            initPCA9635();
        }
        let buf = pins.createBuffer(2);
        buf[0] = 0x02 + channel;
        buf[1] = off & 0xff;
        pins.i2cWriteBuffer(PCA9635_ADD, buf);
    }
    
    /**
     * 控制步进电机
     * @param index 选择要控制的步进电机 (B1: M1+M2, B2: M3+M4)
     * @param dir 旋转方向 (true: 正转, false: 反转)
     */
    function setStepper(index: number, dir: boolean): void {
        if (index == enSteppers.B1) {
            if (dir) {
                setPwm(5, 0, STP_CHA_H);
                setPwm(3, 0, STP_CHB_H);
                setPwm(4, 0, STP_CHC_H);
                setPwm(2, 0, STP_CHD_H);
            } else {
                setPwm(2, 0, STP_CHA_H);
                setPwm(4, 0, STP_CHB_H);
                setPwm(3, 0, STP_CHC_H);
                setPwm(5, 0, STP_CHD_H);
            }
        } else {
            if (dir) {
                setPwm(6, 0, STP_CHA_H);
                setPwm(8, 0, STP_CHB_H);
                setPwm(7, 0, STP_CHC_H);
                setPwm(9, 0, STP_CHD_H);
            } else {
                setPwm(9, 0, STP_CHA_H);
                setPwm(7, 0, STP_CHB_H);
                setPwm(8, 0, STP_CHC_H);
                setPwm(6, 0, STP_CHD_H);
            }
        }
    }
    
     /**
     * 停止指定的电机
     * @param index 电机通道 (2, 4, 6, 8)
     */
    function stopMotor(index: number) {
        setPwm(index, 0, 0);
        setPwm(index + 1, 0, 0);
    }
    /**
     * *****************************************************************
    /**
     * 初始化并获取板载 RGB 灯条对象
     */
    //% blockId=SuperBitV4_RGB_Program block="RGB_Program"
    //% weight=99
    //% blockGap=10
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function RGB_Program(): neopixel.Strip {
         
        if (!yahStrip) {
            yahStrip = neopixel.create(DigitalPin.P12, 4, NeoPixelMode.RGB);
        }
        return yahStrip;  
    } 

     /**
     * 播放内置音乐
     * @param index 选择要播放的音乐
     */
    //% blockId=SuperBitV4_Music block="Music|%index"
    //% weight=98
    //% blockGap=10
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function Music(index: enMusic): void {
        switch (index) {
            case enMusic.dadadum: music.beginMelody(music.builtInMelody(Melodies.Dadadadum), MelodyOptions.Once); break;
            case enMusic.birthday: music.beginMelody(music.builtInMelody(Melodies.Birthday), MelodyOptions.Once); break;
            case enMusic.entertainer: music.beginMelody(music.builtInMelody(Melodies.Entertainer), MelodyOptions.Once); break;
            case enMusic.prelude: music.beginMelody(music.builtInMelody(Melodies.Prelude), MelodyOptions.Once); break;
            case enMusic.ode: music.beginMelody(music.builtInMelody(Melodies.Ode), MelodyOptions.Once); break;
            case enMusic.nyan: music.beginMelody(music.builtInMelody(Melodies.Nyan), MelodyOptions.Once); break;
            case enMusic.ringtone: music.beginMelody(music.builtInMelody(Melodies.Ringtone), MelodyOptions.Once); break;
            case enMusic.funk: music.beginMelody(music.builtInMelody(Melodies.Funk), MelodyOptions.Once); break;
            case enMusic.blues: music.beginMelody(music.builtInMelody(Melodies.Blues), MelodyOptions.Once); break;
            case enMusic.wedding: music.beginMelody(music.builtInMelody(Melodies.Wedding), MelodyOptions.Once); break;
            case enMusic.funereal: music.beginMelody(music.builtInMelody(Melodies.Funeral), MelodyOptions.Once); break;
            case enMusic.punchline: music.beginMelody(music.builtInMelody(Melodies.Punchline), MelodyOptions.Once); break;
            case enMusic.baddy: music.beginMelody(music.builtInMelody(Melodies.Baddy), MelodyOptions.Once); break;
            case enMusic.chase: music.beginMelody(music.builtInMelody(Melodies.Chase), MelodyOptions.Once); break;
            case enMusic.ba_ding: music.beginMelody(music.builtInMelody(Melodies.BaDing), MelodyOptions.Once); break;
            case enMusic.wawawawaa: music.beginMelody(music.builtInMelody(Melodies.Wawawawaa), MelodyOptions.Once); break;
            case enMusic.jump_up: music.beginMelody(music.builtInMelody(Melodies.JumpUp), MelodyOptions.Once); break;
            case enMusic.jump_down: music.beginMelody(music.builtInMelody(Melodies.JumpDown), MelodyOptions.Once); break;
            case enMusic.power_up: music.beginMelody(music.builtInMelody(Melodies.PowerUp), MelodyOptions.Once); break;
            case enMusic.power_down: music.beginMelody(music.builtInMelody(Melodies.PowerDown), MelodyOptions.Once); break;
        }
    }
    
    //% blockId=SuperBitV4_Servo block="Servo(180°)|num %num|value %value"
    //% weight=97
    //% blockGap=10
    //% num.min=1 num.max=4 value.min=0 value.max=180
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=20
    export function Servo(num: enServo, value: number): void {

        // 50hz: 20,000 us
        let us = (value * 1800 / 180 + 600); // 0.6 ~ 2.4
        let pwm = us * 256 / 20000;

        setPwm(num, 0, pwm);

    }

    //% blockId=SuperBitV4_Servo2 block="Servo(270°)|num %num|value %value"
    //% weight=96
    //% blockGap=10
    //% num.min=1 num.max=4 value.min=0 value.max=270
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=20
    export function Servo2(num: enServo, value: number): void {

        // 50hz: 20,000 us
        let newvalue = Math.map(value, 0, 270, 0, 180);
        let us = (newvalue * 1800 / 180 + 600); // 0.6 ~ 2.4
        let pwm = us * 256 / 20000;
        setPwm(num, 0, pwm);

    }

    //% blockId=SuperBitV4_Servo3 block="Servo(360°)|num %num|pos %pos|value %value"
    //% weight=96
    //% blockGap=10
    //% num.min=1 num.max=4 value.min=0 value.max=90
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=20
    export function Servo3(num: enServo, pos: enPos, value: number): void {

        // 50hz: 20,000 us
        
        if (pos == enPos.stop) {
            let us = (86 * 1800 / 180 + 600); // 0.6 ~ 2.4 
            let pwm = us * 256 / 20000;
            setPwm(num, 0, pwm);
        }
        else if(pos == enPos.forward){ //0-90 -> 90 - 0
            let us = ((90-value) * 1800 / 180 + 600); // 0.6 ~ 2.4 
            let pwm = us * 256 / 20000;
            setPwm(num, 0, pwm);
        }
        else if(pos == enPos.reverse){ //0-90 -> 90 -180  
            let us = ((90+value) * 1800 / 180 + 600); // 0.6 ~ 2.4
            let pwm = us * 256 / 20000;
            setPwm(num, 0, pwm);
        }

       

    }

    //% blockId=SuperBitV4_Servo4 block="Servo(360°_rotatable)|num %num|pos %pos|value %value"
    //% weight=96
    //% blockGap=10
    //% num.min=1 num.max=4 value.min=0 value.max=90
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=20
    export function Servo4(num: enServo, pos: enPos, value: number): void {

        // 50hz: 20,000 us
        
        if (pos == enPos.stop) {
            let us = (110 * 1800 / 180 + 600); // 0.6 ~ 2.4 error:86->110
            let pwm = us * 256 / 20000;
            setPwm(num, 0, pwm);
        }
        else if(pos == enPos.forward){ //0-90 -> 90 - 0
            let us = ((110-value) * 1800 / 180 + 600); // 0.6 ~ 2.4 error:90->110
            let pwm = us * 256 / 20000;
            setPwm(num, 0, pwm);
        }
        else if(pos == enPos.reverse){ //0-90 -> 90 -180  error:90->110
            let us = ((110+value) * 1800 / 180 + 600); // 0.6 ~ 2.4
            let pwm = us * 256 / 20000;
            setPwm(num, 0, pwm);
        }

       

    }
    
   
    //% blockId=SuperBitV4_MotorRun block="Motor|%index|speed(-255~255) %speed"
    //% weight=93
    //% speed.min=-255 speed.max=255
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function MotorRun(index: enMotors, speed: number): void {
        if (!initialized) {
            initPCA9635()
        }
        speed = speed * 1;      // map 255 to 255
        if (speed >= 256) {
            speed = 255
        }
        if (speed <= -256) {
            speed = -255
        }

        let a = index
        let b = index + 1
        
        if (a > 4)
        {
            if (speed >= 0) {
                setPwm(a, 0, speed)
                setPwm(b, 0, 0)
            } else {
                setPwm(a, 0, 0)
                setPwm(b, 0, -speed)
            }
        }
        else { 
            if (speed >= 0) {
                setPwm(a, 0, speed)
                setPwm(b, 0, 0)
            } else {
                setPwm(a, 0, 0)
                setPwm(b, 0, -speed)
            }
        }
        
    }

    //% blockId=SuperBitV4_MotorRunDual block="Motor|%motor1|speed %speed1|%motor2|speed %speed2"
    //% weight=92
    //% blockGap=50
    //% speed1.min=-255 speed1.max=255
    //% speed2.min=-255 speed2.max=255
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=2
    export function MotorRunDual(motor1: enMotors, speed1: number, motor2: enMotors, speed2: number): void {
        MotorRun(motor1, speed1);
        MotorRun(motor2, speed2);
    }

    //% blockId=SuperBitV4_MotorStopAll block="Motor Stop All"
    //% weight=91
    //% blockGap=50
    export function MotorStopAll(): void {
        if (!initialized) {
            initPCA9635()
        }
        
        stopMotor(enMotors.M1);
        stopMotor(enMotors.M2);
        stopMotor(enMotors.M3);
        stopMotor(enMotors.M4);
        
    }

}

// Action: wave hand (pose). Registers in window.RobotActions['wave'].
window.RobotActions = window.RobotActions || {};

window.RobotActions.wave = {
    duration: Math.PI * 6,
    dynamic: false,
    update(ctx) {
        const { t, time, bones } = ctx;
        const { rightArm, leftArm } = bones;
        const ease = Math.sin(Math.PI * t);
        const waveAngle = Math.sin(time * 3) * 0.5;
        rightArm.shoulderPivot.rotation.x = Math.PI * 0.8 + ease * 0.2;
        rightArm.shoulderPivot.rotation.z = -0.3 - ease * 0.2;
        rightArm.elbowPivot.rotation.x = -0.5 + waveAngle * 0.8;
        leftArm.shoulderPivot.rotation.x = 0.1;
    }
};

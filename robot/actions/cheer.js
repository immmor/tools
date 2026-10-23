// Action: cheer (pose with small hop). Registers in window.RobotActions['cheer'].
window.RobotActions = window.RobotActions || {};

window.RobotActions.cheer = {
    duration: Math.PI * 1.4,
    dynamic: false,
    update(ctx) {
        const { t, bones, setJumpOffset } = ctx;
        const { pelvisGroup, headGroup, leftArm, rightArm } = bones;
        const ease = Math.sin(Math.PI * t);
        const hop = Math.max(0, Math.sin(t * Math.PI)) * 0.18;
        setJumpOffset(hop);
        pelvisGroup.position.y = 2.0 + hop;
        leftArm.shoulderPivot.rotation.x = -2.5 * ease;
        rightArm.shoulderPivot.rotation.x = -2.5 * ease;
        leftArm.elbowPivot.rotation.x = -0.15;
        rightArm.elbowPivot.rotation.x = -0.15;
        leftArm.shoulderPivot.rotation.z = -0.2;
        rightArm.shoulderPivot.rotation.z = 0.2;
        headGroup.rotation.x = -0.1 * ease;
    }
};

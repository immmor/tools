// Action: wiggle (pose). Registers in window.RobotActions['wiggle'].
window.RobotActions = window.RobotActions || {};

window.RobotActions.wiggle = {
    duration: Math.PI * 2.5,
    dynamic: false,
    update(ctx) {
        const { t, bones } = ctx;
        const { pelvisGroup, headGroup, leftArm, rightArm } = bones;
        const wiggle = Math.sin(t * Math.PI * 6) * 0.2;
        pelvisGroup.rotation.y = wiggle * 0.5;
        pelvisGroup.rotation.z = wiggle * 0.3;
        leftArm.shoulderPivot.rotation.z = wiggle * 1.2;
        rightArm.shoulderPivot.rotation.z = -wiggle * 1.2;
        headGroup.rotation.z = wiggle * 0.5;
        leftArm.shoulderPivot.rotation.x = 0.2;
        rightArm.shoulderPivot.rotation.x = 0.2;
    }
};
